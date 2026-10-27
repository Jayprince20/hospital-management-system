'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { useNotifications } from '@/context/notification-context';
import { useLivekitMedia } from '@/hooks/useLivekitMedia';
import {
  CHAT_MAX_LENGTH,
  TeleEvents,
  lossBetween,
  mapConnectionState,
  qualityFromStats,
  type CallConnection,
  type CallQuality,
  type TeleChatMessage,
  type TeleJoinAck,
  type TeleMedia,
  type TeleRole,
  type TeleSignalData,
  type TeleconsultEventType,
  type TeleconsultOutcome,
} from '@/lib/teleconsultation';

/**
 * One video call between the doctor and the patient. Presence, chat and ending go over the shared
 * Socket.io connection; the media goes through LiveKit when the join issued a LiveKit token
 * (useLivekitMedia), otherwise peer-to-peer WebRTC with signalling over the same socket.
 * Peer-to-peer: The doctor makes the offer when both are in the room; the patient answers.
 * Both sides always negotiate one audio and one video transceiver (sendrecv); a missing camera or
 * microphone is a sender without track, so joining needs no device and turning one on needs no renegotiation.
 */
export interface TeleconsultCall {
  /** The shared socket is connected (joining is possible) */
  ready: boolean;
  joined: boolean;
  joinError: string | null;
  peerPresent: boolean;
  connection: CallConnection;
  quality: CallQuality;
  /** First time media flowed both ways (for the call timer) */
  connectedSince: number | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioOnly: boolean;
  peerMedia: { audio: boolean; video: boolean };
  messages: TeleChatMessage[];
  endedOutcome: TeleconsultOutcome | null;
  join: () => Promise<boolean>;
  leave: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  setAudioOnly: (on: boolean) => void;
  sendChat: (text: string) => void;
}

interface Options {
  appointmentId: string;
  role: TeleRole;
  iceServers: RTCIceServer[];
  /** Camera/microphone chosen in the device check; null to join without any device */
  localStream: MediaStream | null;
  /** Media access issued by the join; null or p2p for peer-to-peer WebRTC */
  media?: TeleMedia | null;
}

const STATS_EVERY_MS = 4000;

export function useTeleconsultCall({ appointmentId, role, iceServers, localStream, media = null }: Options): TeleconsultCall {
  const { getSocket, isConnected: socketConnected } = useNotifications();

  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [peerPresent, setPeerPresent] = useState(false);
  const [pcState, setPcState] = useState<RTCPeerConnectionState | null>(null);
  const [connectedSince, setConnectedSince] = useState<number | null>(null);
  const [quality, setQuality] = useState<CallQuality>('unknown');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(Boolean(localStream?.getAudioTracks().length));
  const [videoEnabled, setVideoEnabled] = useState(Boolean(localStream?.getVideoTracks().length));
  const [audioOnly, setAudioOnlyState] = useState(false);
  const [peerMedia, setPeerMedia] = useState({ audio: true, video: true });
  const [messages, setMessages] = useState<TeleChatMessage[]>([]);
  const [endedOutcome, setEndedOutcome] = useState<TeleconsultOutcome | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const joinedRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const poorLoggedRef = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const localRef = useRef(localStream);
  const audioOnlyRef = useRef(false);
  const mediaRef = useRef({ audio: audioEnabled, video: videoEnabled });

  useEffect(() => {
    localRef.current = localStream;
  }, [localStream]);

  const logEvent = useCallback(
    (type: TeleconsultEventType) => {
      api.logTeleconsultationEvent(appointmentId, type).catch(() => {});
    },
    [appointmentId]
  );

  const livekit = media?.provider === 'livekit' ? media : null;
  const usesLivekit = livekit !== null;
  const lk = useLivekitMedia({ media: livekit, role, active: joined && usesLivekit, localStream, logEvent });
  const { setMicEnabled: lkMic, setCameraEnabled: lkCamera, setAudioOnly: lkAudioOnly } = lk;

  const emit = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      socketRef.current?.emit(event, { appointmentId, ...payload });
    },
    [appointmentId]
  );

  const sendSignal = useCallback((data: TeleSignalData) => emit(TeleEvents.SIGNAL, { data }), [emit]);

  const announceMedia = useCallback(() => {
    emit(TeleEvents.MEDIA, { audio: mediaRef.current.audio, video: mediaRef.current.video && !audioOnlyRef.current });
  }, [emit]);

  const closePeer = useCallback(() => {
    const pc = pcRef.current;
    pcRef.current = null;
    pendingCandidates.current = [];
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    setRemoteStream(null);
    setPcState(null);
  }, []);

  /** Tracks this side sends: none for a missing device, no video while in audio-only mode */
  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localRef.current;
    const audio = stream?.getAudioTracks()[0] ?? null;
    const video = audioOnlyRef.current ? null : stream?.getVideoTracks()[0] ?? null;
    for (const transceiver of pc.getTransceivers()) {
      const kind = transceiver.receiver.track.kind;
      transceiver.direction = 'sendrecv';
      transceiver.sender.replaceTrack(kind === 'audio' ? audio : video).catch(() => {});
    }
  }, []);

  const createPeer = useCallback(
    (asOfferer: boolean): RTCPeerConnection => {
      closePeer();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      const remote = new MediaStream();
      setRemoteStream(remote);
      if (asOfferer) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
        attachLocalTracks(pc);
      }
      pc.ontrack = (event) => {
        if (!remote.getTracks().includes(event.track)) remote.addTrack(event.track);
        // A new MediaStream object makes <video> pick up the added track
        setRemoteStream(new MediaStream(remote.getTracks()));
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) sendSignal({ type: 'candidate', candidate: event.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) return;
        const state = pc.connectionState;
        setPcState(state);
        if (state === 'connected') {
          if (!wasConnectedRef.current) {
            wasConnectedRef.current = true;
            setConnectedSince(Date.now());
            logEvent('connected');
          } else {
            logEvent('reconnect');
          }
        }
        // The doctor restarts ICE when the path breaks; the patient waits for the new offer
        if (state === 'failed' && role === 'DOCTOR') {
          pc.createOffer({ iceRestart: true })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => pc.localDescription && sendSignal({ type: 'offer', sdp: pc.localDescription.sdp }))
            .catch(() => {});
        }
      };
      return pc;
    },
    [iceServers, closePeer, attachLocalTracks, sendSignal, logEvent, role]
  );

  const makeOffer = useCallback(async () => {
    const pc = createPeer(true);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: 'offer', sdp: offer.sdp ?? '' });
    } catch {
      // The next peer-joined or a page reload starts over
    }
  }, [createPeer, sendSignal]);

  const flushCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queued = pendingCandidates.current;
    pendingCandidates.current = [];
    for (const candidate of queued) await pc.addIceCandidate(candidate).catch(() => {});
  }, []);

  const handleSignal = useCallback(
    async ({ data }: { from: TeleRole; data: TeleSignalData }) => {
      if (data.type === 'offer') {
        // Patient side: a first offer, or an ICE restart on the live connection
        const pc = pcRef.current && pcRef.current.connectionState !== 'closed' ? pcRef.current : createPeer(false);
        await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        attachLocalTracks(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'answer', sdp: answer.sdp ?? '' });
        await flushCandidates(pc);
      } else if (data.type === 'answer') {
        const pc = pcRef.current;
        if (!pc || pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await flushCandidates(pc);
      } else if (data.type === 'candidate') {
        const pc = pcRef.current;
        if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
        else pendingCandidates.current.push(data.candidate);
      } else if (data.type === 'hangup') {
        setPeerPresent(false);
        closePeer();
      }
    },
    [createPeer, attachLocalTracks, sendSignal, flushCandidates, closePeer]
  );

  const emitJoin = useCallback(
    (socket: Socket) =>
      new Promise<TeleJoinAck>((resolve) => {
        socket.timeout(10_000).emit(TeleEvents.JOIN, { appointmentId }, (err: Error | null, ack: TeleJoinAck) => {
          resolve(err ? { ok: false, error: 'timeout' } : ack);
        });
      }),
    [appointmentId]
  );

  const afterJoin = useCallback(
    (ack: TeleJoinAck) => {
      const other: TeleRole = role === 'DOCTOR' ? 'PATIENT' : 'DOCTOR';
      const present = Boolean(ack.peers?.includes(other));
      setPeerPresent(present);
      announceMedia();
      if (present && role === 'DOCTOR' && !usesLivekit) void makeOffer();
    },
    [role, announceMedia, makeOffer, usesLivekit]
  );

  // Room events on the shared socket
  useEffect(() => {
    if (!socketConnected) return;
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;
    const other: TeleRole = role === 'DOCTOR' ? 'PATIENT' : 'DOCTOR';

    const onPeerJoined = ({ role: who }: { role: TeleRole }) => {
      if (who !== other) return;
      setPeerPresent(true);
      announceMedia();
      // A (re)joining patient has a fresh connection: the doctor starts over (the patient answers the offer)
      if (role === 'DOCTOR' && !usesLivekit) void makeOffer();
    };
    const onPeerLeft = ({ role: who }: { role: TeleRole }) => {
      if (who !== other) return;
      setPeerPresent(false);
      closePeer();
    };
    const onSignal = (payload: { from: TeleRole; data: TeleSignalData }) => {
      if (usesLivekit) return;
      void handleSignal(payload).catch(() => {});
    };
    const onChat = (message: TeleChatMessage) => setMessages((prev) => [...prev, message].slice(-200));
    const onMedia = ({ role: who, audio, video }: { role: TeleRole; audio: boolean; video: boolean }) => {
      if (who === other) setPeerMedia({ audio, video });
    };
    const onEnded = ({ outcome }: { outcome: TeleconsultOutcome }) => setEndedOutcome(outcome);
    // Back after a network cut: join the room again (the server forgot this socket)
    const onReconnect = () => {
      if (!joinedRef.current) return;
      void emitJoin(socket).then((ack) => ack.ok && afterJoin(ack));
    };

    socket.on(TeleEvents.PEER_JOINED, onPeerJoined);
    socket.on(TeleEvents.PEER_LEFT, onPeerLeft);
    socket.on(TeleEvents.SIGNAL, onSignal);
    socket.on(TeleEvents.CHAT, onChat);
    socket.on(TeleEvents.MEDIA, onMedia);
    socket.on(TeleEvents.ENDED, onEnded);
    socket.on('connect', onReconnect);
    return () => {
      socket.off(TeleEvents.PEER_JOINED, onPeerJoined);
      socket.off(TeleEvents.PEER_LEFT, onPeerLeft);
      socket.off(TeleEvents.SIGNAL, onSignal);
      socket.off(TeleEvents.CHAT, onChat);
      socket.off(TeleEvents.MEDIA, onMedia);
      socket.off(TeleEvents.ENDED, onEnded);
      socket.off('connect', onReconnect);
    };
  }, [socketConnected, getSocket, role, announceMedia, makeOffer, closePeer, handleSignal, emitJoin, afterJoin, usesLivekit]);

  const join = useCallback(async () => {
    const socket = getSocket();
    if (!socket?.connected) {
      setJoinError('socket');
      return false;
    }
    socketRef.current = socket;
    const ack = await emitJoin(socket);
    if (!ack.ok) {
      setJoinError(ack.error || 'join');
      return false;
    }
    setJoinError(null);
    joinedRef.current = true;
    setJoined(true);
    afterJoin(ack);
    return true;
  }, [getSocket, emitJoin, afterJoin]);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    joinedRef.current = false;
    setJoined(false);
    sendSignal({ type: 'hangup' });
    emit(TeleEvents.LEAVE, {});
    logEvent('left');
    closePeer();
    setPeerPresent(false);
  }, [sendSignal, emit, logEvent, closePeer]);

  // Leaving the page (navigation, tab closed): free the room and the devices
  useEffect(() => {
    const onUnload = () => {
      if (joinedRef.current) socketRef.current?.emit(TeleEvents.LEAVE, { appointmentId });
    };
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      if (joinedRef.current) {
        joinedRef.current = false;
        socketRef.current?.emit(TeleEvents.LEAVE, { appointmentId });
      }
      const pc = pcRef.current;
      pcRef.current = null;
      pc?.close();
    };
  }, [appointmentId]);

  const toggleAudio = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    mediaRef.current.audio = track.enabled;
    setAudioEnabled(track.enabled);
    if (usesLivekit) lkMic(track.enabled);
    announceMedia();
  }, [announceMedia, usesLivekit, lkMic]);

  const toggleVideo = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    mediaRef.current.video = track.enabled;
    setVideoEnabled(track.enabled);
    if (usesLivekit) lkCamera(track.enabled);
    announceMedia();
  }, [announceMedia, usesLivekit, lkCamera]);

  /** Audio only: stop sending video to spare a weak connection (the camera track is kept for later) */
  const setAudioOnly = useCallback(
    (on: boolean) => {
      audioOnlyRef.current = on;
      setAudioOnlyState(on);
      if (usesLivekit) lkAudioOnly(on, mediaRef.current.video);
      const pc = pcRef.current;
      if (pc) attachLocalTracks(pc);
      if (on) logEvent('audio-only');
      announceMedia();
    },
    [attachLocalTracks, logEvent, announceMedia, usesLivekit, lkAudioOnly]
  );

  const sendChat = useCallback(
    (text: string) => {
      const trimmed = text.trim().slice(0, CHAT_MAX_LENGTH);
      if (trimmed) emit(TeleEvents.CHAT, { text: trimmed });
    },
    [emit]
  );

  // Connection quality from WebRTC stats (round trip and lost packets)
  useEffect(() => {
    if (pcState !== 'connected') return;
    let previous: { lost: number; received: number } | null = null;
    const timer = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      let rtt: number | null = null;
      const counters = { lost: 0, received: 0 };
      (await pc.getStats()).forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && typeof report.currentRoundTripTime === 'number') rtt = report.currentRoundTripTime;
        if (report.type === 'inbound-rtp') {
          counters.lost += report.packetsLost ?? 0;
          counters.received += report.packetsReceived ?? 0;
        }
      });
      const next = qualityFromStats(rtt, lossBetween(previous, counters));
      previous = counters;
      setQuality(next);
      if (next === 'poor' && !poorLoggedRef.current) {
        poorLoggedRef.current = true;
        logEvent('quality-poor');
      }
    }, STATS_EVERY_MS);
    return () => clearInterval(timer);
  }, [pcState, logEvent]);

  const connection = mapConnectionState({ peerPresent, socketConnected, pcState, wasConnected: connectedSince !== null });

  return {
    ready: socketConnected,
    joined,
    joinError,
    peerPresent,
    connection: usesLivekit ? lk.connection : connection,
    quality: usesLivekit ? lk.quality : quality,
    connectedSince: usesLivekit ? lk.connectedSince : connectedSince,
    remoteStream: usesLivekit ? lk.remoteStream : remoteStream,
    localStream,
    audioEnabled,
    videoEnabled,
    audioOnly,
    peerMedia: usesLivekit ? lk.peerMedia : peerMedia,
    messages,
    endedOutcome,
    join,
    leave,
    toggleAudio,
    toggleVideo,
    setAudioOnly,
    sendChat,
  };
}
