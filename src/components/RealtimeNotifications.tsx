import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useToast } from './ToastContainer';
import { playNotificationSound } from '../lib/notificationSound';

export default function RealtimeNotifications() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const processedTestIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  useEffect(() => {
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 2000);

    if (!profile) return;

    if (profile.role === 'lab_tech') {
      const channel = supabase
        .channel('lab_tech_realtime_notifications')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'visit_tests'
          },
          async (payload) => {
            if (isInitialLoad.current) return;

            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;

            if (
              newRecord.results_status === 'pending' &&
              oldRecord.results_status === 'completed' &&
              !processedTestIds.current.has(newRecord.id)
            ) {
              processedTestIds.current.add(newRecord.id);

              const { data: testData } = await supabase
                .from('visit_tests')
                .select(`
                  test:test_id(name),
                  visit:visit_id(
                    patient:patient_id(name)
                  )
                `)
                .eq('id', newRecord.id)
                .single();

              if (testData) {
                playNotificationSound();
                showToast(
                  `Test sent back to lab: ${(testData as any).test?.name} for ${(testData as any).visit?.patient?.name}`,
                  'info'
                );
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    if (profile.role === 'admin' || profile.role === 'doctor') {
      const channel = supabase
        .channel('doctor_realtime_notifications')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'visit_tests'
          },
          async (payload) => {
            if (isInitialLoad.current) return;

            const newRecord = payload.new as any;
            const oldRecord = payload.old as any;

            if (
              newRecord.results_status === 'completed' &&
              oldRecord.results_status !== 'completed' &&
              newRecord.results_entered_at &&
              !processedTestIds.current.has(newRecord.id)
            ) {
              processedTestIds.current.add(newRecord.id);

              const { data: testData } = await supabase
                .from('visit_tests')
                .select(`
                  test:test_id(name),
                  visit:visit_id(
                    patient:patient_id(name)
                  )
                `)
                .eq('id', newRecord.id)
                .single();

              if (testData) {
                playNotificationSound();
                showToast(
                  `Lab results ready: ${(testData as any).test?.name} for ${(testData as any).visit?.patient?.name}`,
                  'success'
                );
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile, showToast]);

  return null;
}
