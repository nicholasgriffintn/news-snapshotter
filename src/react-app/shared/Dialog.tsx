import { useEffect, useRef, type ReactNode } from "react";

import { IconButton } from "./Button.tsx";

const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

type DialogProps = {
	children: ReactNode;
	className?: string;
	labelledBy: string;
	onClose: () => void;
	panelClassName?: string;
};

export function Dialog({ children, className, labelledBy, onClose, panelClassName }: DialogProps) {
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const previousFocus =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				onClose();
				return;
			}

			if (event.key !== "Tab" || !panelRef.current) {
				return;
			}

			const focusable = [
				...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
			].filter(
				(element) =>
					element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true",
			);
			if (focusable.length === 0) {
				event.preventDefault();
				panelRef.current.focus();
				return;
			}

			const first = focusable[0];
			const last = focusable.at(-1);
			if (
				event.shiftKey &&
				(document.activeElement === first || document.activeElement === panelRef.current)
			) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		}

		document.body.classList.add("modal-open");
		document.addEventListener("keydown", handleKeyDown);
		panelRef.current?.focus();

		return () => {
			document.body.classList.remove("modal-open");
			document.removeEventListener("keydown", handleKeyDown);
			previousFocus?.focus();
		};
	}, [onClose]);

	return (
		<div
			aria-labelledby={labelledBy}
			aria-modal="true"
			className={["modal", className].filter(Boolean).join(" ")}
			onMouseDown={(event) => event.target === event.currentTarget && onClose()}
			role="dialog"
		>
			<div
				className={["modal__panel", panelClassName].filter(Boolean).join(" ")}
				ref={panelRef}
				tabIndex={-1}
			>
				{children}
			</div>
		</div>
	);
}

export function DialogCloseButton({
	className,
	label,
	onClose,
}: {
	className?: string;
	label: string;
	onClose: () => void;
}) {
	return (
		<IconButton
			className={["modal__close", className].filter(Boolean).join(" ")}
			label={label}
			onClick={onClose}
		>
			<span aria-hidden="true">×</span>
		</IconButton>
	);
}
