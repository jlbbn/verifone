import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search, Shield, AlertTriangle, RefreshCw, Clock,
  Phone, ThumbsUp, ThumbsDown, HelpCircle, ChevronDown,
  ChevronRight, Info, Zap, Calendar, TrendingUp, DollarSign,
  Activity, Home, CreditCard,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({
  icon, text, color = "text-blue-600",
}: {
  icon: React.ReactNode; text: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <span className={`flex-shrink-0 ${color}`}>{icon}</span>
      <h2 className="text-base font-bold text-foreground">{text}</h2>
    </div>
  );
}

function Divider({ color = "bg-blue-600" }: { color?: string }) {
  return <div className={`h-0.5 w-10 rounded-full mb-4 ${color}`} />;
}

function BulletItem({ text, bold }: { text: string; bold?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-40" />
      <span>
        {bold && <strong className="text-foreground">{bold} </strong>}
        {text}
      </span>
    </li>
  );
}

function NumberedItem({ n, text, sub }: { n: number; text: string; sub?: string }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="flex-shrink-0 w-6 h-6 rounded-full border border-blue-200 text-blue-600 flex items-center justify-center text-xs font-bold bg-blue-50">
        {n}
      </span>
      <span className="text-muted-foreground leading-relaxed">
        <strong className="text-foreground">{text}</strong>
        {sub && ` ${sub}`}
      </span>
    </li>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-start justify-between gap-3 py-3.5 text-left"
        onClick={() => setOpen(o => !o)}
        data-testid={`faq-toggle-${q.slice(0, 20).replace(/\s/g, "-")}`}
      >
        <span className="text-sm font-semibold text-foreground leading-snug">{q}</span>
        {open
          ? <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
          : <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
        }
      </button>
      {open && (
        <p className="text-sm text-muted-foreground leading-relaxed pb-3.5">{a}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function POSIntelligencePage() {
  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 pb-24 space-y-5">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-[#c8322b]" />
          <h1 className="text-xl font-bold">Decision Intelligence Layer</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Global transaction failure guide — platform diagnostics, reversal timelines, and load lifecycle.
        </p>
      </div>

      {/* Notice banner */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-start gap-3 py-3 px-4">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Failed transactions may not be caused by this platform. The most common root causes
            are the user's payment method, load protocol mismatch, or an expired/unavailable
            load. Review the sections below to identify the exact cause.
          </p>
        </CardContent>
      </Card>

      {/* 1 · What Likely Happened */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<Search className="w-5 h-5" />} text="What Likely Happened" />
          <Divider />
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Your POS transaction failed because the communication between the POS terminal
            and the issuing bank was interrupted at the wrong moment. This can happen for
            several common reasons:
          </p>
          <ul className="space-y-2">
            <BulletItem bold="Network issues:" text="The POS terminal lost connection to the network during the transaction." />
            <BulletItem bold="Power interruption:" text="The terminal battery died or there was a power cut." />
            <BulletItem bold="System timeout:" text="The transaction took too long to complete and timed out." />
            <BulletItem bold="Insufficient balance:" text="Your account didn't have enough funds for the transaction." />
            <BulletItem bold="Card or machine error:" text="The card chip or POS terminal had a technical glitch." />
            <BulletItem bold="Protocol mismatch:" text="The selected transfer protocol (101.x / 201.x / 301.x) was unavailable or incompatible with the receiving host at that moment." />
            <BulletItem bold="Load no longer active:" text="The originating load or card is expired or has been suspended. See the 90-Day Load Window section below." />
          </ul>
          <div className="mt-4 bg-muted/40 rounded-md px-4 py-3 text-sm text-muted-foreground leading-relaxed">
            The most confusing situation is when money is deducted from your account but the
            transaction failed. This happens when your bank approved the payment but never
            received confirmation that the POS terminal completed it.
          </div>
        </CardContent>
      </Card>

      {/* 2 · Why This Happens */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<Shield className="w-5 h-5" />} text="Why This Happens" />
          <Divider />
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            When you use your card on a POS terminal, it is like a conversation between
            three parties: your bank, the POS terminal, and the network connecting them.
            Here is what should happen:
          </p>
          <ol className="space-y-3">
            <NumberedItem n={1} text='The POS terminal asks your bank: "Does this customer have enough money?"' />
            <NumberedItem n={2} text={"Your bank checks and says: \"Yes, I've set aside the money. You can complete the transaction.\""} />
            <NumberedItem n={3} text='"Thank you, the transaction is complete."' sub='The POS terminal responds:' />
            <NumberedItem n={4} text="Your bank then permanently removes the money from your account." />
          </ol>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
            When a transaction fails after money was deducted, it means step 3 never reached
            your bank. Your bank set aside the money but never got confirmation that you
            received your goods or cash. The money is stuck in between — not fully taken,
            not fully returned. This is temporary and always gets resolved.
          </p>
        </CardContent>
      </Card>

      {/* 3 · What This Does NOT Mean */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<AlertTriangle className="w-5 h-5" />} text="What This Does NOT Mean" color="text-amber-500" />
          <Divider color="bg-amber-500" />
          <ul className="space-y-2.5 text-sm">
            {[
              ["Your money is not lost.", "It is in a temporary hold and will be returned."],
              ["You haven't been scammed.", "This is a technical issue, not fraud."],
              ["The POS merchant didn't steal your money.", "They didn't receive it either."],
              ["Your card isn't damaged permanently.", "It will work again."],
              ["Your account isn't blocked.", "Only that specific amount is on hold."],
              ["You will get your money back.", "Failed POS transactions always reverse eventually."],
            ].map(([bold, rest]) => (
              <li key={bold} className="flex items-start gap-2 leading-relaxed">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-muted-foreground"><strong className="text-foreground">{bold}</strong> {rest}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 4 · Reversal Process */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<RefreshCw className="w-5 h-5" />} text="What Happens to Your Money (The Reversal Process)" />
          <Divider />
          <p className="text-sm text-muted-foreground mb-4">
            When a POS transaction fails after money was deducted, here is what happens behind the scenes:
          </p>
          <ol className="space-y-3">
            <NumberedItem n={1} text="The money is on hold:" sub="Your bank set aside the amount but didn't complete the transaction. It's not gone, just temporarily unavailable." />
            <NumberedItem n={2} text="Automatic reversal:" sub="Within 24–72 hours, your bank's system automatically recognizes that the transaction never completed and releases the hold. The money returns to your available balance." />
            <NumberedItem n={3} text="You don't need to do anything:" sub="In most cases, this happens automatically without you contacting anyone." />
            <NumberedItem n={4} text="The merchant never got the money:" sub="The POS merchant didn't receive the funds, so they cannot give you goods or cash." />
          </ol>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
            This process is called an <strong className="text-foreground">automatic reversal</strong> and it's designed
            specifically to protect you in situations like this.
          </p>
        </CardContent>
      </Card>

      {/* 5 · At the POS Machine */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<CreditCard className="w-5 h-5" />} text="What You Can Do Right Now — At the POS Terminal" />
          <Divider />
          <p className="text-sm text-muted-foreground mb-3">
            If you're still at the POS terminal when the transaction fails, follow these steps immediately:
          </p>
          <ul className="space-y-2">
            <BulletItem bold="Do not leave the spot." text="Stay right where you are until the issue is resolved." />
            <BulletItem bold="Ask the merchant to check the POS terminal." text='Look at the screen — it may show "Transaction failed" or "Timeout."' />
            <BulletItem bold="Request a reversal receipt." text="Some POS terminals can print a reversal receipt immediately. This proves the transaction failed." />
            <BulletItem bold="Take a photo of the POS screen." text="If the machine shows an error message, photograph it with your phone." />
            <BulletItem bold="Note the POS terminal ID if visible." text="This helps the bank trace the transaction faster." />
            <BulletItem bold="Write down the merchant's name and contact." text="You may need this if the reversal is delayed." />
          </ul>
        </CardContent>
      </Card>

      {/* 6 · If Already Left */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<Home className="w-5 h-5" />} text="What to Do If You've Already Left" color="text-indigo-600" />
          <Divider color="bg-indigo-600" />
          <p className="text-sm text-muted-foreground mb-3">
            If you've already left the location and realized later that money was deducted but the transaction failed:
          </p>
          <ul className="space-y-2">
            <BulletItem bold="Don't panic." text="The automatic reversal will happen within 72 hours in most cases." />
            <BulletItem bold="Check your account after 24 hours." text="Many reversals happen overnight." />
            <BulletItem bold="Contact your bank if it's been more than 72 hours." text="If the money hasn't returned after 3 full days, call your bank." />
            <BulletItem bold="Try to contact the merchant." text="If you have their details, let them know what happened. They may have already seen the failed transaction on their end." />
            <BulletItem bold="Keep all evidence." text="Save SMS alerts, screenshots, and any receipts you have." />
          </ul>
        </CardContent>
      </Card>

      {/* 7 · Error Messages */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<AlertTriangle className="w-5 h-5" />} text="Common POS Error Messages and What They Mean" color="text-red-500" />
          <Divider color="bg-red-500" />
          <div className="space-y-4">
            {[
              {
                code: '"Transaction failed" or "Declined"',
                means: "The transaction could not be completed. This could be due to network, balance, or technical issues.",
                todo: "Check your balance. If money was deducted, it will reverse automatically.",
              },
              {
                code: '"Timeout" or "Connection timeout"',
                means: "The POS terminal couldn't reach your bank's system fast enough.",
                todo: "This is a common network issue. Wait a few minutes before trying again.",
              },
              {
                code: '"Card error" or "Read card error"',
                means: "The POS terminal couldn't read your card's chip.",
                todo: "Clean the chip gently with a soft cloth. Try inserting the card again slowly.",
              },
              {
                code: '"PIN error" or "Invalid PIN"',
                means: "The PIN you entered was incorrect.",
                todo: "Try again carefully. If you've forgotten your PIN, use another payment method.",
              },
              {
                code: '"Amount exceeds limit"',
                means: "The transaction amount is above your daily card limit.",
                todo: "Split the payment into smaller amounts or use another payment method.",
              },
              {
                code: '"ERR_HOST_DISCONNECT" or "ERR_NO_AUTH_BANK_HOST"',
                means: "The bank host connection was interrupted or the host could not authenticate the transaction.",
                todo: "This is a host-side error, not a platform issue. The transaction will be automatically reversed within 24–72 hours.",
              },
            ].map(({ code, means, todo }) => (
              <div key={code} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-semibold text-foreground mb-1">{code}</p>
                <p className="text-xs text-muted-foreground mb-1">
                  <em className="not-italic font-medium text-foreground">What it means:</em>{" "}
                  {means}
                </p>
                <p className="text-xs text-muted-foreground">
                  <em className="not-italic font-medium text-foreground">What to do:</em>{" "}
                  {todo}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 8 · Reversal Timeline */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<Clock className="w-5 h-5" />} text="How Long Does Reversal Take?" />
          <Divider />
          <p className="text-sm text-muted-foreground mb-4">
            Failed POS transaction reversals typically happen within these timeframes:
          </p>
          <div className="space-y-3">
            {[
              { label: "Immediate reversal", desc: "Some banks reverse failed transactions within minutes.", color: "bg-green-100 text-green-700" },
              { label: "24 hours", desc: "Most automatic reversals happen within 24 hours.", color: "bg-blue-100 text-blue-700" },
              { label: "48–72 hours", desc: "In some cases, it can take up to 3 working days.", color: "bg-amber-100 text-amber-700" },
              { label: "After 72 hours", desc: "If the money hasn't returned, contact your bank to file a complaint.", color: "bg-red-100 text-red-700" },
            ].map(({ label, desc, color }) => (
              <div key={label} className="flex items-start gap-3">
                <Badge className={`${color} no-default-active-elevate text-xs flex-shrink-0 mt-0.5`}>{label}</Badge>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Weekends and public holidays may add extra time, as reversals are often processed
            on business days.
          </p>
        </CardContent>
      </Card>

      {/* 9 · Contact Your Bank */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<Phone className="w-5 h-5" />} text="When and How to Contact Your Bank" color="text-teal-600" />
          <Divider color="bg-teal-600" />
          <p className="text-sm text-muted-foreground mb-3">You should contact your bank if:</p>
          <ul className="space-y-2 mb-4">
            <BulletItem text="More than 72 hours have passed and the money hasn't returned." />
            <BulletItem text="You received a receipt showing the transaction was completed, but you didn't get goods or cash." />
            <BulletItem text="The same amount was deducted twice." />
            <BulletItem text="Your bank app shows a completed transaction but the merchant says it failed." />
          </ul>
          <div className="bg-muted/40 rounded-md px-4 py-3 text-sm text-muted-foreground">
            When calling, have ready: your card number (last 4 digits), transaction date and
            time, amount, merchant name, and any reference or receipt number.
          </div>
        </CardContent>
      </Card>

      {/* 10 · What Helps / What Doesn't */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-green-200">
          <CardContent className="px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-bold text-green-700">What Helps</h3>
            </div>
            <ul className="space-y-1.5">
              {[
                "Stay at the POS terminal until the issue is resolved",
                "Take photos of error messages and receipts",
                "Save SMS alerts from your bank",
                "Write down the merchant's name and contact",
                "Note the POS terminal ID if visible",
                "Wait 24–72 hours for automatic reversal",
                "Keep your transaction reference number",
                "Contact your bank politely with all details ready",
              ].map(t => (
                <li key={t} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="mt-1 w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardContent className="px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-red-600">What Doesn't Help</h3>
            </div>
            <ul className="space-y-1.5">
              {[
                "Leaving without resolving the issue",
                "Yelling at the POS merchant — it's not their fault",
                "Trying the transaction repeatedly (more than 2–3 times)",
                "Assuming the money is gone forever",
                "Ignoring the issue hoping it will fix itself",
                "Sharing your PIN with anyone offering to help",
                "Using unofficial third parties to 'trace' your money",
                "Getting angry with bank customer service",
              ].map(t => (
                <li key={t} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="mt-1 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 11 · 90-Day Load Window */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<Calendar className="w-5 h-5" />} text="90-Day Live Load Window" color="text-blue-600" />
          <Divider />
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            All active loads (cargas vivas) on this platform have a <strong className="text-foreground">maximum validity
            period of 90 calendar days</strong> from the date of issuance. After this window expires,
            the load becomes unavailable and any transaction attempted against it will fail at
            the host level — not at the platform level.
          </p>
          <div className="space-y-3">
            {[
              {
                icon: <Zap className="w-3.5 h-3.5 text-green-600" />,
                label: "Days 1–60",
                desc: "Load is fully active. All protocols (101.x, 201.x, 301.x, 401.x) are available.",
                badge: "bg-green-100 text-green-700",
                badgeText: "Active",
              },
              {
                icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
                label: "Days 61–89",
                desc: "Load is in grace period. Reduced protocol availability; only 101.3 (Transferencia segura) and 201.3 (Pago express) are guaranteed.",
                badge: "bg-amber-100 text-amber-700",
                badgeText: "Grace Period",
              },
              {
                icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
                label: "Day 90+",
                desc: "Load has expired. All transactions will return ERR_HOST_DISCONNECT or ERR_NO_AUTH_BANK_HOST. The platform is not responsible for these failures.",
                badge: "bg-red-100 text-red-700",
                badgeText: "Expired",
              },
            ].map(({ icon, label, desc, badge, badgeText }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold">{label}</p>
                    <Badge className={`${badge} text-[10px] no-default-active-elevate`}>{badgeText}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-white border border-blue-200 rounded-md px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Important:</strong> If a user reports a failed transaction and their load
            was issued more than 90 days ago, the failure is caused by an expired load — not
            by the platform, the protocol, or the POS terminal. Ask them to renew or reissue
            their load before retrying.
          </div>
        </CardContent>
      </Card>

      {/* 12 · Lifetime Sequel Value */}
      <Card>
        <CardContent className="px-5 py-5">
          <SectionTitle icon={<TrendingUp className="w-5 h-5" />} text="Lifetime Sequel Value (LSV)" color="text-purple-600" />
          <Divider color="bg-purple-600" />
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Lifetime Sequel Value (LSV) is the estimated total revenue a single active
            load or user generates across all sequential transaction cycles within their
            active window. Unlike traditional LTV, LSV accounts for the{" "}
            <strong className="text-foreground">90-day load expiry</strong> and models the
            probability of a user renewing their load for additional cycles.
          </p>

          {/* Formula box */}
          <div className="bg-muted/50 border border-border rounded-md px-4 py-4 mb-4 font-mono text-xs text-center space-y-1">
            <p className="text-foreground font-semibold">LSV = (AOV × TF × CR) × RC</p>
            <div className="text-muted-foreground grid grid-cols-2 gap-1 mt-2 text-left max-w-xs mx-auto">
              <span>AOV</span><span>— Average Order / Transaction Value</span>
              <span>TF</span><span>— Transaction Frequency (per 90-day cycle)</span>
              <span>CR</span><span>— Completion Rate (non-failed transactions)</span>
              <span>RC</span><span>— Renewal Cycles (number of 90-day windows)</span>
            </div>
          </div>

          {/* Thresholds */}
          <div className="space-y-3 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LSV Tiers</p>
            {[
              { tier: "High Value", color: "bg-purple-100 text-purple-700", desc: "LSV > $50,000 USD · RC ≥ 4 · CR ≥ 90%", action: "Priority support. Flag for VIP load renewal before Day 85." },
              { tier: "Standard", color: "bg-blue-100 text-blue-700", desc: "LSV $5,000–$50,000 USD · RC 2–3 · CR 75–89%", action: "Standard support. Send renewal reminder at Day 75." },
              { tier: "At Risk", color: "bg-amber-100 text-amber-700", desc: "LSV < $5,000 USD · RC ≤ 1 · CR < 75%", action: "Elevated failed-transaction rate. Review protocol compatibility." },
              { tier: "Lapsed", color: "bg-red-100 text-red-700", desc: "No activity after Day 90 · RC = 0", action: "Load has expired. Do not attribute failures to platform." },
            ].map(({ tier, color, desc, action }) => (
              <div key={tier} className="flex items-start gap-3 p-3 bg-muted/30 rounded-md">
                <Badge className={`${color} no-default-active-elevate text-xs flex-shrink-0 mt-0.5`}>{tier}</Badge>
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{desc}</p>
                  <p className="text-xs text-foreground mt-0.5">{action}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Key insight */}
          <div className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-md px-4 py-3">
            <Activity className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Key insight:</strong> A user with a high LSV whose load is approaching
              Day 90 represents a high-priority renewal opportunity. Proactive outreach
              before expiry reduces failed-transaction rates and preserves platform integrity
              metrics.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 13 · FAQ */}
      <Card>
        <CardContent className="px-5 py-5">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold">Frequently Asked Questions</h2>
          </div>
          <Divider />
          <div>
            {[
              {
                q: "Money was deducted but I didn't get my cash/goods. Will I get my money back?",
                a: "Yes, absolutely. This is called a failed transaction reversal. Your bank will automatically return the money to your account within 24–72 hours. You do not need to do anything special — just wait. If it hasn't returned after 72 hours, contact your bank with your transaction reference number.",
              },
              {
                q: "Is this a platform error or a user-side error?",
                a: "Most transaction failures are caused by the user's payment method (expired card, insufficient balance, unsupported card type), an incompatible protocol selected for the transaction type, or a load that has exceeded the 90-day validity window. Platform-side errors are rare and are always logged with an internal incident ID.",
              },
              {
                q: "Can I retry the transaction immediately?",
                a: "You may retry once or twice, but avoid doing so more than 2–3 times. Repeated failed attempts can temporarily flag your card for security review by your bank. If the first retry also fails, wait 30 minutes before trying again.",
              },
              {
                q: "What does ERR_NO_AUTH_BANK_HOST mean?",
                a: "This error means the bank host was unable to authenticate the transaction. This typically occurs when the load is expired (past 90 days), the protocol selected does not match the host requirements, or the issuing bank's host experienced a temporary outage. The platform is not responsible for host-side authentication failures.",
              },
              {
                q: "How do I know which protocol to use?",
                a: "For standard transfers, use 101.3 (Transferencia segura) — it is the recommended and most reliable protocol. For domestic payments use 201.1, for international payments use 201.2, and for express payments use 201.3. If you are unsure, always default to 101.3.",
              },
              {
                q: "What happens after 90 days if I don't renew my load?",
                a: "After 90 days, all transaction attempts against that load will fail at the bank host level. The platform will return ERR_HOST_DISCONNECT or ERR_NO_AUTH_BANK_HOST. To continue transacting, you must request a new load issuance. Any funds tied to the expired load are not affected — they remain in your account.",
              },
            ].map(faq => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
