import { Button } from "../../shared/Button.tsx";

type LegalPageProps = {
	kind: "privacy" | "terms";
	onContact: () => void;
};

export function LegalPage({ kind, onContact }: LegalPageProps) {
	if (kind === "privacy") {
		return (
			<article className="legal-page">
				<h1>Privacy notice</h1>
				<p className="legal-page__updated">Effective 16 July 2026</p>
				<section>
					<h2>Information we handle</h2>
					<p>
						Browsing the public archive does not require an account. The archive does not set its
						own analytics or advertising cookies. Cloudflare may process standard request
						information, including IP addresses and technical request metadata, to deliver, secure,
						and protect the service.
					</p>
				</section>
				<section>
					<h2>Contact messages</h2>
					<p>
						When you contact us, your name, email address, message, reason, and any supplied
						captured URL are sent through Cloudflare Email Service to the Pashi archive mailbox. The
						application does not place contact messages in its database, although the resulting
						email is retained in the mailbox as needed to respond and keep an appropriate record.
					</p>
				</section>
				<section>
					<h2>Your questions and requests</h2>
					<p>
						To ask about information submitted through the contact form, request correction or
						deletion, or raise another privacy concern,{" "}
						<Button onClick={onContact} variant="text">
							contact us
						</Button>
						.
					</p>
				</section>
			</article>
		);
	}

	return (
		<article className="legal-page">
			<h1>Terms of use</h1>
			<p className="legal-page__updated">Effective 16 July 2026</p>
			<section>
				<h2>About the archive</h2>
				<p>
					Pashi provides historical screenshots of publicly accessible publisher pages for archival,
					research, historical, and educational purposes. It is independent and is not affiliated
					with or endorsed by the publishers shown.
				</p>
			</section>
			<section>
				<h2>Publisher rights and current information</h2>
				<p>
					Publisher names, trademarks, logos, and copyright remain the property of their respective
					owners. Pashi claims no ownership of archived publisher content. Screenshots may be
					incomplete, outdated, or differ from the current page. Follow the displayed source URL for
					the latest publisher version.
				</p>
			</section>
			<section>
				<h2>Acceptable use</h2>
				<p>
					Do not use the service unlawfully, attempt to bypass access controls, interfere with its
					operation, overload its APIs, or represent archived material as current publisher content.
				</p>
			</section>
			<section>
				<h2>Availability and external sites</h2>
				<p>
					The archive is provided as available without a promise that every capture is complete or
					accurate. Links lead to third-party publisher sites with their own terms and privacy
					practices.
				</p>
			</section>
			<section>
				<h2>Rights-holder concerns</h2>
				<p>
					If you believe material in the archive affects your rights, please identify the captured
					URL and explain your concern using the{" "}
					<Button onClick={onContact} variant="text">
						contact form
					</Button>
					. We review all requests promptly and, where appropriate, may remove or restrict access to
					archived material.
				</p>
				<p>Submission of a request does not guarantee removal.</p>
			</section>
		</article>
	);
}
