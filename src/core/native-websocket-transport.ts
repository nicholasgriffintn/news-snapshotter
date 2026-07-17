export type WebSocketTransport = {
	close: () => void;
	onclose?: () => void;
	onmessage?: (message: string) => void;
	send: (message: string) => void;
};

type WebSocketFactory = (url: string) => WebSocket;

export function createNativeWebSocketTransport(
	url: string,
	createWebSocket: WebSocketFactory = (endpoint) => new WebSocket(endpoint),
): Promise<WebSocketTransport> {
	return new Promise((resolve, reject) => {
		const socket = createWebSocket(url);

		socket.addEventListener("open", () => {
			const transport: WebSocketTransport = {
				close: () => socket.close(),
				send: (message) => socket.send(message),
			};

			socket.addEventListener("message", (event) => {
				if (typeof event.data === "string") {
					transport.onmessage?.(event.data);
				}
			});
			socket.addEventListener("close", () => transport.onclose?.());
			socket.addEventListener("error", () => {});
			resolve(transport);
		}, { once: true });
		socket.addEventListener("error", () => reject(
			new Error("Could not connect to browser WebSocket"),
		), { once: true });
	});
}
