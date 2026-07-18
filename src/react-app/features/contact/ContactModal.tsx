import { useEffect, useState } from "react";

import { sendContactMessage } from "../../platform/api-client.ts";

export function ContactModal({ onClose }: { onClose: () => void }) {
	const [startedAt] = useState(() => Date.now());
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [reason, setReason] = useState<"general" | "privacy" | "rights-holder">("rights-holder");
	const [sourceUrl, setSourceUrl] = useState("");
	const [message, setMessage] = useState("");
	const [website, setWebsite] = useState("");
	const [status, setStatus] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
			}
		}

		document.body.classList.add("modal-open");
		window.addEventListener("keydown", closeOnEscape);
		return () => {
			document.body.classList.remove("modal-open");
			window.removeEventListener("keydown", closeOnEscape);
		};
	}, [onClose]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		setStatus("Sending…");

		try {
			await sendContactMessage({
				email,
				message,
				name,
				reason,
				sourceUrl: sourceUrl || undefined,
				startedAt,
				website,
			});
			setStatus("Message sent. We will review your request promptly and respond if necessary.");
			setMessage("");
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Message could not be sent.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div
			aria-labelledby="contact-title"
			aria-modal="true"
			className="modal contact-modal"
			onMouseDown={(event) => event.target === event.currentTarget && onClose()}
			role="dialog"
		>
			<div className="contact-modal__panel">
				<header className="contact-modal__header">
					<div>
						<h2 id="contact-title">Send a message</h2>
					</div>
					<button
						aria-label="Close contact form"
						className="modal__close"
						onClick={onClose}
						type="button"
					>
						×
					</button>
				</header>

				<form onSubmit={submit}>
					<div className="contact-modal__row">
						<label>
							<span>Name</span>
							<input
								autoComplete="name"
								maxLength={100}
								onChange={(event) => setName(event.target.value)}
								required
								value={name}
							/>
						</label>
						<label>
							<span>Email</span>
							<input
								autoComplete="email"
								maxLength={254}
								onChange={(event) => setEmail(event.target.value)}
								required
								type="email"
								value={email}
							/>
						</label>
					</div>

					<label>
						<span>Reason</span>
						<select
							onChange={(event) => setReason(event.target.value as typeof reason)}
							value={reason}
						>
							<option value="rights-holder">Rights-holder concern</option>
							<option value="privacy">Privacy request</option>
							<option value="general">General enquiry</option>
						</select>
					</label>

					<label>
						<span>Captured URL (optional)</span>
						<input
							maxLength={2048}
							onChange={(event) => setSourceUrl(event.target.value)}
							placeholder="https://publisher.example/article"
							type="url"
							value={sourceUrl}
						/>
					</label>

					<label>
						<span>Message</span>
						<textarea
							maxLength={4000}
							minLength={20}
							onChange={(event) => setMessage(event.target.value)}
							required
							rows={7}
							value={message}
						/>
					</label>

					<label className="contact-modal__honeypot" aria-hidden="true">
						<span>Website</span>
						<input
							autoComplete="off"
							onChange={(event) => setWebsite(event.target.value)}
							tabIndex={-1}
							value={website}
						/>
					</label>

					<button className="impact-button" disabled={submitting} type="submit">
						{submitting ? "Sending…" : "Send message"}
					</button>
					<p aria-live="polite" className="contact-modal__status">
						{status}
					</p>
				</form>
			</div>
		</div>
	);
}
