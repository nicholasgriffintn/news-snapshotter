import type { Env } from './env';

const EMAIL_PATTERN = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
const CONTACT_REASONS = ['general', 'privacy', 'rights-holder'] as const;

type ContactReason = (typeof CONTACT_REASONS)[number];

type ContactRequest = {
	email: string;
	message: string;
	name: string;
	reason: ContactReason;
	sourceUrl?: string;
	startedAt: number;
	website?: string;
};

function isContactReason(value: unknown): value is ContactReason {
	return typeof value === 'string' && CONTACT_REASONS.includes(value as ContactReason);
}

function parseContactRequest(value: unknown): ContactRequest {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Contact request must be a JSON object');
	}

	const body = value as Record<string, unknown>;
	if (
		typeof body.name !== 'string' ||
		body.name.trim().length < 2 ||
		body.name.length > 100 ||
		/[\r\n]/.test(body.name)
	) {
		throw new Error('Enter a name between 2 and 100 characters');
	}
	if (typeof body.email !== 'string' || body.email.length > 254 || !EMAIL_PATTERN.test(body.email)) {
		throw new Error('Enter a valid email address');
	}
	if (typeof body.message !== 'string' || body.message.trim().length < 20 || body.message.length > 4_000) {
		throw new Error('Enter a message between 20 and 4,000 characters');
	}
	if (!isContactReason(body.reason)) throw new Error('Choose a valid contact reason');
	if (typeof body.startedAt !== 'number') throw new Error('Invalid form submission');
	if (body.sourceUrl !== undefined && (typeof body.sourceUrl !== 'string' || body.sourceUrl.length > 2_048)) {
		throw new Error('Source URL is too long');

	}

	return {
		email: body.email,
		message: body.message.trim(),
		name: body.name.trim(),
		reason: body.reason,
		sourceUrl: body.sourceUrl as string | undefined,
		startedAt: body.startedAt,
		website: typeof body.website === 'string' ? body.website : undefined,
	};
}

export async function sendContactMessage(request: Request, env: Env): Promise<Response> {
	const contact = parseContactRequest(await request.json());
	const elapsed = Date.now() - contact.startedAt;
	if (contact.website || elapsed < 3_000 || elapsed > 24 * 60 * 60 * 1_000) {
		return Response.json({ status: 'success' });
	}

	const rateLimit = await env.CONTACT_RATE_LIMIT.limit({ key: contact.email.toLowerCase() });
	if (!rateLimit.success) {
		return Response.json({ message: 'Too many messages. Try again later.' }, { status: 429 });
	}
	const source = contact.sourceUrl ? `\nCaptured page: ${contact.sourceUrl}` : '';
	try {
		await env.CONTACT_EMAIL.send({
			to: "pashi@nicholasgriffin.dev",
			from: "contact@email.pashi.app",
			subject: `Pashi archive contact: ${contact.reason}`,
			text: [
				`Name: ${contact.name}`,
				`Email: ${contact.email}`,
				`Reason: ${contact.reason}${source}`,
				'',
				contact.message,
			].join('\n'),
		});
	} catch {
		console.error('Contact email delivery failed');
		return Response.json({ message: 'Message could not be sent. Try again later.' }, { status: 502 });
	}

	return Response.json({ status: 'success' });
}
