"""
Find every column a query names that the database does not have.

PostgREST rejects the WHOLE select on an unknown column, and Supabase surfaces
that as `data: null` with an error most call sites never read — so the query
does not crash, it silently returns nothing. Seven billing bugs today came from
exactly that, every one invisible on the happy path.

Deliberately conservative: bare columns on known tables only, embeds and
expressions skipped, anything ambiguous treated as fine. A sweep that cries wolf
gets ignored, which is worse than not running it.
"""
import io, os, re

SCHEMA = {
 'admin_desktop_prefs': 'background,clerk_id,hidden_apps,icon_positions,installed_apps,updated_at',
 'admin_notes': 'body,content_edited_at,created_at,id,owner_clerk_id,pin_order,starred,title,updated_at',
 'admin_notification_prefs': 'account_deleted,agent_leg_refused,agent_online,cancel,id,master_enabled,new_sub,payment_failed,pool_capacity,renewal,resub,signup,sub_paused,sub_resumed,team_join,updated_at,webhook_silence',
 'admin_notifications': 'body,created_at,delivered_to,event_type,id,pushed,read_at,title,url',
 'agencies': 'created_at,id,name,owner_id,seat_count',
 'agent_predictive_prefs': 'campaign_id,created_at,id,preferred_lines,set_by_owner,updated_at,user_id',
 'agent_sessions': 'campaign_id,created_at,current_call_id,current_dial_group_id,dialer_mode,id,last_heartbeat,online_notified_at,predictive_armed,session_started_at,state,team_id,updated_at,user_id',
 'agent_sip_credentials': 'clerk_id,connection_id,created_at,id,last_fetched_at,sip_username,telnyx_credential_id,updated_at',
 'billing_events': 'amount_cents,clerk_id,created_at,event_type,hidden_at,id,plan,retention_weeks,stripe_subscription_id,user_email,user_name',
 'calendar_events': 'all_day,call_id,color,created_at,description,ends_at,event_type,id,lead_id,recurrence_until,rrule,source,starts_at,title,updated_at,user_id',
 'call_events': 'call_control_id,call_id,campaign_id,created_at,detail,event_type,id,lead_id,signalwire_call_id,source,status,user_id',
 'calls': 'agent_call_control_id,amd_requested,amd_result,answered_at,bridged_at,buffer_started_at,buffer_state,call_control_id,campaign_id,created_at,dial_group_id,dial_source,disposition,duration,id,lead_id,phone_number,pool_number_id,recording_duration,recording_expires_at,recording_id,recording_status,recording_url,signalwire_call_id,talk_seconds,team_id,user_id,was_abandoned',
 'campaign_abandon_rate_30d': 'abandon_rate_pct,abandons_30d,answers_30d,campaign_id',
 'campaign_agents': 'campaign_id,created_at,granted_by,granted_via,id,team_id,user_id',
 'campaign_script_links': 'campaign_id,created_at,id,script_id,sort_order',
 'campaigns': 'agent_picks_mode,amd_enabled,called_leads,conversion_dispositions,created_at,dial_repeat_count,dialer_mode,disconnect_behavior,enable_appointments_sub,enable_not_interested_sub,id,ingest_enabled,ingest_token,last_lead_added_at,mask_lead_numbers,name,predictive_lines_max,predictive_lines_min,predictive_lines_per_agent,recording_enabled,script,status,total_leads,updated_at,user_id,voicemail_drop_url',
 'custom_themes': 'created_at,header_bg_color,id,logo_url,name,page_bg_color,primary_color,sidebar_color,updated_at,user_id',
 'data_preserved_users': 'clerk_id,preserved_at,reason',
 'desktop_icons': 'app_id,clerk_id,grid_x,grid_y,installed,pinned,updated_at',
 'desktop_prefs': 'background_id,clerk_id,focused_window_id,top_z,updated_at',
 'desktop_windows': 'app_id,clerk_id,height,id,maximized,minimized,opened_at,pre_maximize,updated_at,width,x,y,z_index',
 'dial_attempts': 'attempt_number,attempted_at,call_id,campaign_id,from_number,id,lead_id,outcome,user_id',
 'dialer_down_status': 'enabled,id,message,password_hash,password_salt,updated_at,updated_by',
 'dialer_sessions': 'campaign_id,ended_at,id,last_heartbeat_at,started_at,team_id,user_id',
 'feature_flags': 'description,enabled,key,updated_at',
 'gmail_oauth_tokens': 'access_token,clerk_id,created_at,email,expires_at,id,refresh_token,scopes,token_type,updated_at',
 'lead_ingest_events': 'accepted,campaign_id,created_at,duplicates,id,message,ok,received,rejected,source_ip',
 'lead_notes': 'created_at,disposition,id,lead_id,note,source,user_id',
 'leads': 'address,call_count,campaign_id,city,claimed_at,claimed_by_session_id,consent_date,consent_description,consent_proof_url,consent_source,created_at,dial_attempts,disposition,email,extra_data,first_name,id,last_called,last_called_at,last_name,next_eligible_at,notes,phone,state,status,user_id,zip',
 'manager_desktop_prefs': 'background,clerk_id,hidden_apps,icon_positions,installed_apps,updated_at',
 'ops_alert_log': 'alert_key,created_at,detail,id',
 'pacing_metrics': 'campaign_id,id,metric_date,total_abandons,total_amd_detected,total_answers,total_connects,total_dials,total_predictive_groups,updated_at',
 'page_views': 'country,created_at,device,dwell_ms,id,is_authed,path,referrer_host,region,utm_campaign,utm_medium,utm_source,visitor_hash',
 'pending_reactivations': 'created_at,email,id,original_clerk_id,owed_until,plan,redeemed_at,stripe_customer_id',
 'phone_numbers': 'acquired_at,area_code,created_at,daily_call_count,daily_cap,flag_reason,health_answer_rate,health_checked_at,health_window_answered,health_window_calls,id,is_registered,last_called_at,last_flagged_at,lifetime_call_count,monthly_cost_cents,phone_number,provider_number_id,region,rested_reason,signalwire_sid,state,status,updated_at',
 'platform_config': 'agent_leg_refusal_alert_count,amd_after_greeting_silence_ms,amd_detector,amd_enabled_global,amd_greeting_duration_ms,amd_hangup_when_bridged,amd_hold_seconds_after_machine,amd_in_preview,amd_initial_silence_ms,amd_max_seconds_after_answer,amd_max_words,amd_total_analysis_ms,amd_tuning_enabled,concurrency_budget,hangup_poll_interval_ms,id,number_buying_frozen,poll_interval_ms,pool_capacity_alert_pct,predictive_line_ceiling,recording_enabled_global,updated_at,webhook_silence_minutes',
 'pool_config': 'buys_today,buys_today_date,daily_buy_cap,id,last_ratio_reconcile_at,last_reconcile_month,last_target_pool_size,max_pool_size,numbers_per_user,pool_floor,ratio_cycling_enabled,reconcile_locked_until,release_cooldown_days,sustained_hours_required,updated_at,updated_by,utilization_trigger_pct',
 'pool_cycle_log': 'active_subs,added,cooldown_blocked,created_at,detail,floor_applied,id,numbers_per_user,pool_after,pool_before,released,target_pool_size,trigger',
 'predictive_dial_groups': 'campaign_id,created_at,id,lines_attempted,lines_lookup,resolved_at,routed_at,status,triggering_agent_id,winning_agent_id,winning_call_id',
 'promo_banner_status': 'bg_color,enabled,id,message,text_color,updated_at,updated_by',
 'push_subscriptions': 'auth,clerk_id,created_at,endpoint,id,last_used_at,p256dh,user_agent',
 'scripts': 'body,created_at,id,name,sort_order,team_id,updated_at,user_id',
 'stripe_events': 'attempts,error_message,event_id,event_type,livemode,processed_at,processing_status,received_at',
 'subdomain_history': 'created_at,id,new_slug,old_slug,redirects_until,tenant_id',
 'subscriptions': 'cancel_at_period_end,canceled_at,created_at,current_period_end,current_period_start,discount_coupon,id,last_event_at,paused_at,plan,status,stripe_customer_id,stripe_price_id,stripe_subscription_id,trial_end,trial_start,updated_at,user_id',
 'support_submissions': 'body,clerk_id,created_at,disposition,id,responded_at,responded_by,response_body,response_channel,snap_email,snap_name,snap_username,status,subject,tenant_id,type,updated_at',
 'suppression_list': 'created_at,id,phone_e164,reason,scope,source,user_id',
 'team_agent_payments': 'agent_id,campaign_id,canceled_at,created_at,id,status,stripe_subscription_id,team_id',
 'team_analytics': 'abandon_count,active_agents_peak,calls_made,created_at,id,owner_cost_cents,period_end,period_start,talk_time_seconds,team_id',
 'team_campaign_access': 'access_source,campaign_id,granted_at,granted_via_code_id,id,is_active,payer,revoked_at,team_id,team_member_id',
 'team_campaigns': 'access_mode,campaign_id,created_at,team_id',
 'team_codes': 'campaign_id,code,code_type,created_at,id,is_active,join_mode,max_uses,payer,seat_price_override_cents,team_id,use_count',
 'team_join_requests': 'campaign_id,code_id,created_at,decided_at,decided_by,id,status,team_id,user_id',
 'team_member_status_logs': 'duration_seconds,ended_at,id,started_at,state,team_id,team_member_id',
 'team_members': 'accepted_at,billing_override,billing_takeover_at,billing_takeover_reason,created_at,decision_seen_at,id,joined_via_code,removed_at,seat_price_override_cents,seat_suspend_reason,seat_suspended_at,status,team_id,user_id',
 'team_seat_charges': 'agent_id,amount_cents,created_at,enforced_at,id,owner_id,period_end,period_start,refunded_amount_cents,status,stripe_invoice_id,stripe_subscription_item_id,team_id,team_member_id',
 'teams': 'created_at,description,id,name,owner_id,tenant_id,updated_at',
 'telephony_events': 'attempts,call_sid,error_message,event_key,processed_at,processing_status,received_at,sequence_no,status,webhook',
 'telnyx_events': 'attempts,created_at,error_message,event_id,event_type,processed_at,processing_status',
 'tenant_branding': 'accent_color,background_color,brand_name,custom_landing,favicon_url,footer_text,header_bg_color,id,login_link_label,login_link_text,login_link_url,logo_url,page_bg_color,primary_color,secondary_color,sidebar_color,slug,status,text_color',
 'tenant_invites': 'accepted_at,accepted_by,billing_override,created_at,email,expires_at,id,invited_by,status,team_id,tenant_id,token',
 'users': 'active_tenant_id,clerk_id,created_at,email,exclude_from_analytics,first_name,has_data,id,is_admin,last_name,last_seen_at,phone,report_address,report_legal_name,report_tax_id_note,stripe_customer_id,subscription_status,username,wl_onboarding_status,wl_subscription_id',
 'view_team_realtime_health': 'agents_dialing,agents_on_call,agents_online,agents_ready,calls_last_hour,team_id,team_name,total_lifetime_spend_cents',
 'white_label_tenants': 'accent_color,background_color,brand_name,created_at,custom_domain,custom_landing,favicon_url,footer_text,header_bg_color,id,is_active,is_demo,last_applied_theme_id,login_link_label,login_link_text,login_link_url,logo_url,owner_clerk_id,page_bg_color,primary_color,secondary_color,sidebar_color,slug,slug_changed_at,status,stripe_customer_id,stripe_subscription_id,support_email,text_color,updated_at',
}
COLS = {t: set(c.split(',')) for t, c in SCHEMA.items()}

ROOTS = ['app', 'lib', 'components']
SKIP = {'node_modules', '.next', '.git'}

FROM_RE = re.compile(r"\.from\(\s*'([a-z_0-9]+)'\s*\)")
SELECT_RE = re.compile(r"\.select\(\s*'([^']*)'")
FILTER_RE = re.compile(r"\.(?:eq|neq|gt|gte|lt|lte|is|in|like|ilike|order)\(\s*'([a-zA-Z_0-9]+)'")

findings, seen = [], set()

for root in ROOTS:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        for fn in filenames:
            if not fn.endswith(('.ts', '.tsx')):
                continue
            path = os.path.join(dirpath, fn).replace('\\', '/')
            src = io.open(path, encoding='utf-8', errors='replace').read()

            for m in FROM_RE.finditer(src):
                table = m.group(1)
                if table not in COLS:
                    continue
                nxt = FROM_RE.search(src, m.end())
                end = nxt.start() if nxt else min(len(src), m.end() + 1200)
                window = src[m.end():end]

                names = []
                sel = SELECT_RE.search(window)
                if sel:
                    raw = re.sub(r"[a-z_0-9]+\s*\([^)]*\)", "", sel.group(1))
                    for part in raw.split(','):
                        c = part.strip()
                        if c and c != '*' and re.fullmatch(r"[a-z_][a-z_0-9]*", c):
                            names.append(('select', c))
                for f in FILTER_RE.finditer(window):
                    names.append(('filter', f.group(1)))

                for kind, c in names:
                    if c not in COLS[table]:
                        key = (path, table, c)
                        if key in seen:
                            continue
                        seen.add(key)
                        findings.append((path, src[:m.start()].count('\n') + 1, table, kind, c))

if not findings:
    print('CLEAN — every column named matches the schema.')
else:
    print(f'{len(findings)} mismatch(es):\n')
    for path, line, table, kind, col in sorted(findings):
        print(f'{path}:{line}  {table}.{col}  ({kind})')
