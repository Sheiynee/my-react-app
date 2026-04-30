import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Change EMAIL_FROM to a verified sender domain once you've set one up in Resend.
// During development, 'onboarding@resend.dev' works without domain verification.
const FROM = process.env.EMAIL_FROM || 'TaskFlow <onboarding@resend.dev>'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const PRIORITY_LABEL = {
  low: '🟢 Low',
  medium: '🟡 Medium',
  high: '🟠 High',
  urgent: '🔴 Urgent',
}

export async function sendAssignmentEmail({
  toEmail,
  memberName,
  taskTitle,
  projectName,
  projectId,
  assignedByName,
  priority,
  dueDate,
}) {
  const priorityLabel = PRIORITY_LABEL[priority] ?? priority
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', { dateStyle: 'medium' })
    : 'No due date'

  const safeMember = escapeHtml(memberName)
  const safeAssigner = escapeHtml(assignedByName)
  const safeProject = escapeHtml(projectName)
  const safeTitle = escapeHtml(taskTitle)
  const safePriority = escapeHtml(priorityLabel)
  const safeDue = escapeHtml(dueDateStr)
  const safeUrl = `${FRONTEND_URL}/projects/${encodeURIComponent(projectId)}`

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `You've been assigned: ${taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff">
        <div style="background:#388bfd;border-radius:8px 8px 0 0;padding:20px 24px">
          <h1 style="color:#ffffff;margin:0;font-size:20px">📋 New Task Assignment</h1>
        </div>
        <div style="border:1px solid #e1e4e8;border-top:none;border-radius:0 0 8px 8px;padding:24px">
          <p style="margin:0 0 16px;color:#24292f">Hi <strong>${safeMember}</strong>,</p>
          <p style="margin:0 0 16px;color:#24292f">
            <strong>${safeAssigner}</strong> has assigned you to a task in
            <strong>${safeProject}</strong>.
          </p>
          <div style="background:#f6f8fa;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #388bfd">
            <p style="margin:0 0 8px;color:#24292f;font-size:16px;font-weight:600">${safeTitle}</p>
            <p style="margin:0 0 6px;color:#57606a;font-size:14px"><strong>Priority:</strong> ${safePriority}</p>
            <p style="margin:0;color:#57606a;font-size:14px"><strong>Due:</strong> ${safeDue}</p>
          </div>
          <a
            href="${safeUrl}"
            style="display:inline-block;background:#388bfd;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;margin-top:8px"
          >
            View Task →
          </a>
          <p style="color:#8c959f;font-size:12px;margin-top:24px;border-top:1px solid #e1e4e8;padding-top:16px">
            TaskFlow · You received this because you were assigned to this task.
          </p>
        </div>
      </div>
    `,
  })
}
