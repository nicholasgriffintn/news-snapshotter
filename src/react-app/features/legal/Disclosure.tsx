import { Button } from "../../shared/Button.tsx";
import { Dialog, DialogCloseButton } from "../../shared/Dialog.tsx";

type DisclosureContentProps = {
	onContact: () => void;
	titleId: string;
};

function DisclosureContent({ onContact, titleId }: DisclosureContentProps) {
	return (
		<>
			<h2 id={titleId}>Independent. Historical. Unaffiliated.</h2>
			<p>
				This website is an independent historical archive and is not affiliated with or endorsed by
				any publisher featured.
			</p>
			<p>
				All trademarks, logos and other intellectual property remain the property of their
				respective owners. Content is displayed solely for archival, historical, research and
				educational purposes.
			</p>
			<p>
				Where possible, users are encouraged to visit the original publisher for the latest version
				of any content.
			</p>
			<p>
				If you are a rights holder and have questions or concerns about material appearing on this
				site, please{" "}
				<Button onClick={onContact} variant="text">
					contact us
				</Button>{" "}
				and we will review your request promptly.
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
	return (
		<Dialog
			className="disclosure-modal"
			labelledBy="disclosure-modal-title"
			onClose={onClose}
			panelClassName="disclosure-modal__panel"
		>
			<DialogCloseButton
				className="disclosure-modal__close"
				label="Close archive disclosure"
				onClose={onClose}
			/>
			<div className="disclosure-modal__content">
				<DisclosureContent onContact={onContact} titleId="disclosure-modal-title" />
			</div>
		</Dialog>
	);
}
