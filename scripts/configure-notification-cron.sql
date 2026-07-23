begin;

select public.configure_order_notification_drain_schedule() as job_id;

do $$
declare
  matching_jobs integer;
begin
  select count(*)
  into matching_jobs
  from cron.job
  where jobname = 'drain-order-notification-queue'
    and schedule = '* * * * *'
    and command = 'select public.request_order_notification_drain();'
    and active;

  if matching_jobs <> 1 then
    raise exception 'Expected exactly one active order notification drain job, found %',
      matching_jobs;
  end if;
end
$$;

commit;

select jobid, jobname, schedule, active
from cron.job
where jobname = 'drain-order-notification-queue';
