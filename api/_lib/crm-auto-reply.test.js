import assert from 'node:assert/strict'
import test from 'node:test'

import { isAutoReplyEmail } from './crm-auto-reply.js'

test('detects vacation replies from the authoritative Auto-Submitted header', () => {
  assert.equal(
    isAutoReplyEmail({
      from: 'person@example.com',
      subject: 'Re: Project discussion',
      body: 'Thanks for your message.',
      headers: { 'Auto-Submitted': 'auto-replied (vacation)' },
    }),
    true,
  )
})

test('treats Auto-Submitted: no as human-originated', () => {
  assert.equal(
    isAutoReplyEmail({
      from: 'person@example.com',
      subject: 'Re: Project discussion',
      body: 'Let us schedule a call.',
      headers: { 'Auto-Submitted': 'no' },
    }),
    false,
  )
})

test('detects Bright White-style annual-leave body text', () => {
  assert.equal(
    isAutoReplyEmail({
      from: 'person@example.com',
      subject: 'Re: Project discussion',
      body: 'I am currently away from my desk on annual leave.',
    }),
    true,
  )
})

test('does not classify a substantive reply as automatic', () => {
  assert.equal(
    isAutoReplyEmail({
      from: 'person@example.com',
      subject: 'Re: Project discussion',
      body: 'This looks relevant. Can you send a timeline and budget?',
    }),
    false,
  )
})
