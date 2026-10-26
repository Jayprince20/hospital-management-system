'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type ConnectionQuality,
  type Participant,
  type RemoteParticipant,
} from 'livekit-client';
import { isPeerIdentity, mapLivekitConnection, qualityFromLivekit, type LivekitRoomState } from '@/lib/livekit-call';
import type { CallConnection, CallQuality, TeleMedia, TeleRole, TeleconsultEventType } from '@/lib/teleconsultation';

type LivekitMedia = Extract<TeleMedia, { provider: 'livekit' }>;

export interface LivekitCallMedia {
  connection: CallConnection;
  quality: CallQuality;
  remoteStream: MediaStream | null;
  connectedSince: number | null;
  peerMedia: { audio: boolean; video: boolean };
  setMicEnabled: (on: boolean) => void;
  setCameraEnabled: (on: boolean) => void;
  /** Stop sending and receiving video; on leaving audio-only the camera comes back if it was on */
  setAudioOnly: (on: boolean, cameraOn: boolean) => void;
}

interface Options {
  /** null: this call does not use LiveKit (the hook stays idle) */
  media: LivekitMedia | null;
  role: TeleRole;
  /** Joined the teleconsultation room (socket): connect to LiveKit only then */
  active: boolean;
  /** Camera/microphone chosen in the device check, published as is (no second device prompt) */
  localStream: MediaStream | null;
  logEvent: (type: TeleconsultEventType) => void;
}

/**
 * The media side of a teleconsultation through a LiveKit server (SFU): presence, chat and ending
 * stay on Socket.io in useTeleconsultCall. adaptiveStream is off on purpose: it pauses video that
 * is not attached with track.attach(), and the call UI plays a plain MediaStream.
 */
export function useLivekitMedia({ media, role, active, localStream, logEvent }: Options): LivekitCallMedia {
  const [roomState, setRoomState] = useState<LivekitRoomState>('disconnected');
  const [failed, setFailed] = useState(false);
  const [peerInRoom, setPeerInRoom] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectedSince, setConnectedSince] = useState<number | null>(null);
  const [quality, setQuality] = useState<CallQuality>('unknown');
  const [peerMedia, setPeerMedia] = useState({ audio: true, video: true });

  const roomRef = useRef<Room | null>(null);
  const localRef = useRef(localStream);
  const logRef = useRef(logEvent);
  const wasConnectedRef = useRef(false);
  const poorLoggedRef = useRef(false);
  const audioOnlyRef = useRef(false);

  useEffect(() => {
    localRef.current = localStream;
    logRef.current = logEvent;
  }, [localStream, logEvent]);

  const url = media?.url ?? null;
  const token = media?.token ?? null;

  useEffect(() => {
    if (!active || !url || !token) return;
    const room = new Room({ adaptiveStream: false, dynacast: true, disconnectOnPageLeave: true, stopLocalTrackOnUnpublish: false });
    roomRef.current = room;
    let disposed = false;

    const peerOf = (): RemoteParticipant | undefined =>
      [...room.remoteParticipants.values()].find((p) => isPeerIdentity(p.identity, role));

    // The other side's subscribed tracks, as one stream for the <video> element
    const refreshPeer = () => {
      const peer = peerOf();
      setPeerInRoom(Boolean(peer));
      if (!peer) {
        setRemoteStream(null);
        return;
      }
      const tracks: MediaStreamTrack[] = [];
      for (const pub of peer.trackPublications.values()) {
        if (pub.track && pub.isSubscribed) tracks.push(pub.track.mediaStreamTrack);
      }
      setRemoteStream(tracks.length ? new MediaStream(tracks) : null);
      const mic = peer.getTrackPublication(Track.Source.Microphone);
      const cam = peer.getTrackPublication(Track.Source.Camera);
      setPeerMedia({ audio: Boolean(mic && !mic.isMuted), video: Boolean(cam && !cam.isMuted) });
    };

    const onSubscribed = (_track: unknown, _pub: unknown, participant: RemoteParticipant) => {
      if (!isPeerIdentity(participant.identity, role)) return;
      // Remote video stays off while this side is in audio-only mode
      if (audioOnlyRef.current) participant.getTrackPublication(Track.Source.Camera)?.setSubscribed(false);
      if (!wasConnectedRef.current) {
        wasConnectedRef.current = true;
        setConnectedSince(Date.now());
        logRef.current('connected');
      }
      refreshPeer();
    };
    const onQuality = (q: ConnectionQuality, participant: Participant) => {
      if (participant !== room.localParticipant) return;
      const next = qualityFromLivekit(q as unknown as Parameters<typeof qualityFromLivekit>[0]);
      setQuality(next);
      if (next === 'poor' && !poorLoggedRef.current) {
        poorLoggedRef.current = true;
        logRef.current('quality-poor');
      }
    };

    room
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => setRoomState(state as unknown as LivekitRoomState))
      .on(RoomEvent.Reconnected, () => logRef.current('reconnect'))
      .on(RoomEvent.ParticipantConnected, refreshPeer)
      .on(RoomEvent.ParticipantDisconnected, refreshPeer)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, refreshPeer)
      .on(RoomEvent.TrackMuted, refreshPeer)
      .on(RoomEvent.TrackUnmuted, refreshPeer)
      .on(RoomEvent.ConnectionQualityChanged, onQuality);

    (async () => {
      try {
        await room.connect(url, token);
        if (disposed) return;
        setFailed(false);
        const stream = localRef.current;
        const mic = stream?.getAudioTracks()[0];
        const cam = stream?.getVideoTracks()[0];
        if (mic) await room.localParticipant.publishTrack(mic, { source: Track.Source.Microphone });
        if (cam) await room.localParticipant.publishTrack(cam, { source: Track.Source.Camera });
        // A device turned off before joining starts muted
        if (mic && !mic.enabled) await room.localParticipant.getTrackPublication(Track.Source.Microphone)?.mute();
        if (cam && (!cam.enabled || audioOnlyRef.current)) await room.localParticipant.getTrackPublication(Track.Source.Camera)?.mute();
        refreshPeer();
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      roomRef.current = null;
      room.removeAllListeners();
      void room.disconnect();
      setRoomState('disconnected');
      setPeerInRoom(false);
      setRemoteStream(null);
    };
  }, [active, url, token, role]);

  const setMicEnabled = useCallback((on: boolean) => {
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Microphone);
    void (on ? pub?.unmute() : pub?.mute());
  }, []);

  const setCameraEnabled = useCallback((on: boolean) => {
    const pub = roomRef.current?.localParticipant.getTrackPublication(Track.Source.Camera);
    void (on && !audioOnlyRef.current ? pub?.unmute() : pub?.mute());
  }, []);

  const setAudioOnly = useCallback((on: boolean, cameraOn: boolean) => {
    audioOnlyRef.current = on;
    const room = roomRef.current;
    if (!room) return;
    const cam = room.localParticipant.getTrackPublication(Track.Source.Camera);
    void (on || !cameraOn ? cam?.mute() : cam?.unmute());
    for (const p of room.remoteParticipants.values()) p.getTrackPublication(Track.Source.Camera)?.setSubscribed(!on);
  }, []);

  return {
    connection: mapLivekitConnection({ roomState, failed, peerInRoom, wasConnected: connectedSince !== null }),
    quality,
    remoteStream,
    connectedSince,
    peerMedia,
    setMicEnabled,
    setCameraEnabled,
    setAudioOnly,
  };
}
