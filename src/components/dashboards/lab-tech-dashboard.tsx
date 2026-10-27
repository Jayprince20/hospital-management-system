'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FlaskConical,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Microscope,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, type LabOrder } from '@/lib/api';
import { useToast } from '@/components/toast';
import { useLanguage } from '@/context/language-context';

export function LabTechDashboard() {
  const toast = useToast();
  const router = useRouter();
  const { t, tEnum, formatDateTime } = useLanguage();
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLabOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLabOrders = async () => {
    try {
      setLoading(true);
      const response = await api.getLabOrders({ limit: 100 });
      setLabOrders(response.labOrders || []);
    } catch (error) {
      console.error('Failed to fetch lab orders:', error);
      toast.error(t('admin.labtech.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const testNames = (order: LabOrder) => order.tests.map((test) => test.name).join(', ') || t('admin.labtech.labTest');
  const orderHref = (order: LabOrder) => `/dashboard/laboratory/orders/${order.id}`;

  // Waiting = ordered or sample collected; in progress = processing in the lab
  const pendingOrders = labOrders.filter((o) => o.status === 'ORDERED' || o.status === 'SAMPLE_COLLECTED');
  const inProgressOrders = labOrders.filter((o) => o.status === 'PROCESSING');
  const completedToday = labOrders.filter(
    (o) => o.status === 'COMPLETED' && o.completedAt && new Date(o.completedAt).toDateString() === new Date().toDateString()
  );
  const urgentOrders = labOrders.filter(
    (o) => (o.priority === 'URGENT' || o.priority === 'STAT') && o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
  );

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'STAT':
        return <Badge variant="destructive">{tEnum('STAT')}</Badge>;
      case 'URGENT':
        return <Badge className="bg-orange-500">{tEnum('URGENT')}</Badge>;
      default:
        return <Badge variant="secondary">{tEnum('ROUTINE')}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-500">{tEnum(status)}</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-blue-500">{tEnum(status)}</Badge>;
      default:
        return <Badge variant="outline">{tEnum(status)}</Badge>;
    }
  };

  const actionButton = (order: LabOrder, variant?: 'destructive') => (
    <Link href={orderHref(order)}>
      <Button size="sm" variant={variant}>
        {order.status === 'PROCESSING' ? t('admin.labtech.enterResults') : t('admin.labtech.startProcessing')}
      </Button>
    </Link>
  );

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
            <CardTitle className="text-sm font-medium">{t('admin.labtech.pendingTests')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
            <p className="text-xs text-muted-foreground">{t('admin.labtech.awaitingProcessing')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.labtech.inProgress')}</CardTitle>
            <Microscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressOrders.length}</div>
            <p className="text-xs text-muted-foreground">{t('admin.labtech.currentlyProcessing')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.labtech.completedToday')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday.length}</div>
            <p className="text-xs text-muted-foreground">{t('admin.labtech.resultsSubmitted')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin.labtech.urgentStat')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{urgentOrders.length}</div>
            <p className="text-xs text-muted-foreground">{t('admin.labtech.highPriorityPending')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.labtech.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Button variant="outline" onClick={() => router.push('/dashboard/laboratory')}>
            <FlaskConical className="mr-2 h-4 w-4" />
            {t('admin.labtech.viewAllOrders')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/patients')}>
            <FileText className="mr-2 h-4 w-4" />
            {t('admin.labtech.patientRecords')}
          </Button>
        </CardContent>
      </Card>

      {/* Urgent Orders Alert */}
      {urgentOrders.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('admin.labtech.urgentLabOrders')}
            </CardTitle>
            <CardDescription className="text-red-600">
              {t('admin.labtech.theseOrdersRequireImmediateAttention')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.labtech.patient')}</TableHead>
                  <TableHead>{t('admin.labtech.testType')}</TableHead>
                  <TableHead>{t('admin.labtech.priority')}</TableHead>
                  <TableHead>{t('admin.labtech.orderedBy')}</TableHead>
                  <TableHead>{t('admin.labtech.time')}</TableHead>
                  <TableHead>{t('admin.labtech.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urgentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.patientName}
                    </TableCell>
                    <TableCell>{testNames(order)}</TableCell>
                    <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                    <TableCell>{order.doctorName}</TableCell>
                    <TableCell>
                      {formatDateTime(order.createdAt, { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      {actionButton(order, order.status === 'PROCESSING' ? undefined : 'destructive')}
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
          <CardTitle>{t('admin.labtech.pendingLabOrders')}</CardTitle>
          <CardDescription>{t('admin.labtech.testsWaitingToBeProcessed')}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t('admin.labtech.noPendingLabOrders')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.labtech.patient')}</TableHead>
                  <TableHead>{t('admin.labtech.testType')}</TableHead>
                  <TableHead>{t('admin.labtech.priority')}</TableHead>
                  <TableHead>{t('admin.labtech.orderedBy')}</TableHead>
                  <TableHead>{t('admin.labtech.dateTime')}</TableHead>
                  <TableHead>{t('admin.labtech.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.patientName}
                    </TableCell>
                    <TableCell>{testNames(order)}</TableCell>
                    <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                    <TableCell>{order.doctorName}</TableCell>
                    <TableCell>
                      {formatDateTime(order.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      {actionButton(order)}
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
          <CardTitle>{t('admin.labtech.testsInProgress')}</CardTitle>
          <CardDescription>{t('admin.labtech.currentlyBeingProcessedReadyForResults')}</CardDescription>
        </CardHeader>
        <CardContent>
          {inProgressOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t('admin.labtech.noTestsCurrentlyInProgress')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.labtech.patient')}</TableHead>
                  <TableHead>{t('admin.labtech.testType')}</TableHead>
                  <TableHead>{t('admin.labtech.priority')}</TableHead>
                  <TableHead>{t('admin.labtech.status')}</TableHead>
                  <TableHead>{t('admin.labtech.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inProgressOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.patientName}
                    </TableCell>
                    <TableCell>{testNames(order)}</TableCell>
                    <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      {actionButton(order)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
