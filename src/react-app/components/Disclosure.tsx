import { useEffect } from 'react';

type DisclosureContentProps = {
	onContact: () => void;
	titleId: string;
};

function DisclosureContent({ onContact, titleId }: DisclosureContentProps) {
	return (
		<>
			<p className="eyebrow">About this site</p>
			<h2 id={titleId}>Independent. Historical. Unaffiliated.</h2>
			<p>
				This website is an independent historical archive and is not affiliated with or endorsed by any publisher featured.
			</p>
			<p>
				All trademarks, logos and other intellectual property remain the property of their respective owners.
				Content is displayed solely for archival, historical, research and educational purposes.
			</p>
			<p>
				Where possible, users are encouraged to visit the original publisher for the latest version of any content.
			</p>
			<p>
				If you are a rights holder and have questions or concerns about material appearing on this site,
				please{' '}
				<button className="text-button" onClick={onContact} type="button">
					contact us
				</button>{' '}and we will review your request promptly.
			</p>
		</>
	);
}

export function Disclosure({ onContact }: { onContact: () => void }) {
	return (
		<aside className="disclosure" aria-labelledby="disclosure-title">
			<DisclosureContent onContact={onContact} titleId="disclosure-title" />
		</aside>
	);
}

type DisclosureModalProps = {
	onClose: () => void;
	onContact: () => void;
};

export function DisclosureModal({ onClose, onContact }: DisclosureModalProps) {
	useEffect(() => {
		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}

		document.body.classList.add('modal-open');
		window.addEventListener('keydown', closeOnEscape);

		return () => {
			document.body.classList.remove('modal-open');
			window.removeEventListener('keydown', closeOnEscape);
		};
	}, [onClose]);

	return (
		<div
			aria-labelledby="disclosure-modal-title"
			aria-modal="true"
			className="modal disclosure-modal"
			onMouseDown={(event) => event.target === event.currentTarget && onClose()}
			role="dialog"
		>
			<div className="disclosure-modal__panel">
				<button
					aria-label="Close archive disclosure"
					className="modal__close disclosure-modal__close"
					onClick={onClose}
					type="button"
				>
					×
				</button>
				<div className="disclosure-modal__content">
					<DisclosureContent onContact={onContact} titleId="disclosure-modal-title" />
				</div>
			</div>
		</div>
	);
}
