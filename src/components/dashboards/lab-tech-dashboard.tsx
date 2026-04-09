'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Microscope,
  Activity,
  Upload,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/toast';
import { format } from 'date-fns';

interface LabOrder {
  id: string;
  patientId: string;
  patient?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  };
  doctorId: string;
  doctor?: {
    firstName: string;
    lastName: string;
  };
  testType: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'routine' | 'urgent' | 'stat';
  notes?: string;
  results?: string;
  createdAt: string;
  completedAt?: string;
}

export function LabTechDashboard() {
  const toast = useToast();
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [resultsForm, setResultsForm] = useState({
    results: '',
    status: 'completed' as const,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLabOrders();
  }, []);

  const fetchLabOrders = async () => {
    try {
      setLoading(true);
      const response = await api.getLabOrders();
      if (response.labOrders) {
        // Map to our interface format
        setLabOrders(response.labOrders.map((order: any) => ({
          id: order.id,
          patientId: order.patientId,
          patient: order.patient,
          doctorId: order.doctorId,
          doctor: order.doctor,
          testType: order.items?.[0]?.test?.name || 'Lab Test',
          status: order.status?.toLowerCase() as any,
          priority: order.priority?.toLowerCase() as any,
          notes: order.notes,
          results: order.items?.[0]?.result,
          createdAt: order.createdAt,
          completedAt: order.completedAt,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch lab orders:', error);
      toast.error('Failed to load lab orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcessing = async (order: LabOrder) => {
    try {
      await api.updateLabOrder(order.id, { status: 'PROCESSING' });
      toast.success('Lab order marked as in progress');
      fetchLabOrders();
    } catch (error) {
      console.error('Failed to update lab order:', error);
      toast.error('Failed to update lab order');
    }
  };

  const handleOpenResultsDialog = (order: LabOrder) => {
    setSelectedOrder(order);
    setResultsForm({
      results: order.results || '',
      status: 'completed',
      notes: order.notes || '',
    });
    setResultsDialogOpen(true);
  };

  const handleSubmitResults = async () => {
    if (!selectedOrder) return;

    try {
      setSubmitting(true);
      await api.updateLabOrder(selectedOrder.id, {
        status: 'COMPLETED',
        notes: resultsForm.notes,
      });
      toast.success('Lab results submitted successfully');
      setResultsDialogOpen(false);
      setSelectedOrder(null);
      fetchLabOrders();
    } catch (error) {
      console.error('Failed to submit results:', error);
      toast.error('Failed to submit results');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingOrders = labOrders.filter(o => o.status === 'pending');
  const inProgressOrders = labOrders.filter(o => o.status === 'in_progress');
  const completedToday = labOrders.filter(
    o => o.status === 'completed' &&
    o.completedAt &&
    new Date(o.completedAt).toDateString() === new Date().toDateString()
  );
  const urgentOrders = labOrders.filter(
    o => (o.priority === 'urgent' || o.priority === 'stat') && o.status !== 'completed'
  );

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'stat':
        return <Badge variant="destructive">STAT</Badge>;
      case 'urgent':
        return <Badge className="bg-orange-500">Urgent</Badge>;
      default:
        return <Badge variant="secondary">Routine</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Microscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressOrders.length}</div>
            <p className="text-xs text-muted-foreground">Currently processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday.length}</div>
            <p className="text-xs text-muted-foreground">Results submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent/STAT</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentOrders.length}</div>
            <p className="text-xs text-muted-foreground">High priority pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard/laboratory'}>
            <FlaskConical className="mr-2 h-4 w-4" />
            View All Orders
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard/patients'}>
            <FileText className="mr-2 h-4 w-4" />
            Patient Records
          </Button>
          <Button variant="outline">
            <Activity className="mr-2 h-4 w-4" />
            Quality Control
          </Button>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload Results
          </Button>
        </CardContent>
      </Card>

      {/* Urgent Orders Alert */}
      {urgentOrders.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Urgent Lab Orders
            </CardTitle>
            <CardDescription className="text-red-600">
              These orders require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Ordered By</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urgentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </TableCell>
                    <TableCell>{order.testType}</TableCell>
                    <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                    <TableCell>
                      Dr. {order.doctor?.firstName} {order.doctor?.lastName}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.createdAt), 'HH:mm')}
                    </TableCell>
                    <TableCell>
                      {order.status === 'pending' ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStartProcessing(order)}
                        >
                          Start Now
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenResultsDialog(order)}
                        >
                          Enter Results
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pending Lab Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Lab Orders</CardTitle>
          <CardDescription>Tests waiting to be processed</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No pending lab orders
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Ordered By</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </TableCell>
                    <TableCell>{order.testType}</TableCell>
                    <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                    <TableCell>
                      Dr. {order.doctor?.firstName} {order.doctor?.lastName}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.createdAt), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleStartProcessing(order)}
                      >
                        Start Processing
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* In Progress Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Tests In Progress</CardTitle>
          <CardDescription>Currently being processed - ready for results entry</CardDescription>
        </CardHeader>
        <CardContent>
          {inProgressOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No tests currently in progress
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inProgressOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </TableCell>
                    <TableCell>{order.testType}</TableCell>
                    <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleOpenResultsDialog(order)}
                      >
                        Enter Results
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Results Entry Dialog */}
      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enter Lab Results</DialogTitle>
            <DialogDescription>
              {selectedOrder && (
                <>
                  Patient: {selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName} |
                  Test: {selectedOrder.testType}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="results">Test Results *</Label>
              <Textarea
                id="results"
                placeholder="Enter detailed test results..."
                value={resultsForm.results}
                onChange={(e) => setResultsForm(prev => ({ ...prev, results: e.target.value }))}
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Result Status</Label>
              <Select
                value={resultsForm.status}
                onValueChange={(value) => setResultsForm(prev => ({ ...prev, status: value as 'completed' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed - Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes or observations..."
                value={resultsForm.notes}
                onChange={(e) => setResultsForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitResults}
              disabled={!resultsForm.results || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Results'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
