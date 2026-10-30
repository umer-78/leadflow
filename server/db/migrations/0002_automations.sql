ALTER TABLE "appointments" ADD COLUMN "manage_token" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "patient_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "waitlist" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "waitlist_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "automations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD COLUMN "appointment_id" uuid;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_appointment_idx" ON "outbound_messages" USING btree ("appointment_id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_manage_token_unique" UNIQUE("manage_token");