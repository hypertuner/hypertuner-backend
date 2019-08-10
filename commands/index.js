import React, { useEffect } from "react";
import { Text, Color, Box } from "ink";

import uWS from "uWebSockets.js";
import handler from "serve-handler";

import express from "express";
import watcher from "nsfw";

import fs from "fs-extra";

import { useLogState } from "../core/utils";
import { webSocketPort, staticPort, staticPath } from "../core/config";

/// Main backend start
const Main = () => {
	const [restStatus, restStatusColor, setRestStatus] = useLogState(
		"rest",
		"🔄\tSpinning up the static app . . .",
		"yellow"
	);

	const [socketStatus, socketStatusColor, setSocketStatus] = useLogState(
		"socket",
		"🔄\tSpinning up socket server . . .",
		"yellow"
	);

	const [watcherStatus, watcherStatusColor, setWatcherStatus] = useLogState(
		"watcher",
		"🔄\tPrepare storage folder . . .",
		"yellow"
	);

	useEffect(() => {
		const server = express();
		// parse application/json
		server.use(express.json());

		server.post("/create-config", (req, res) => {
			setRestStatus(JSON.stringify(req.body));

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					success: true
				})
			);
		});

		server.get("/*", (req, res) => {
			handler(req, res, {
				public: staticPath
			});
		});

		server.listen(staticPort, () => {
			setRestStatus(
				`🚀\tReady at http://localhost:${staticPort} . . .`,
				"green"
			);
		});

		uWS
			.App()
			.ws("/*", {
				compression: 0,
				maxPayloadLength: 16 * 1024 * 1024,
				idleTimeout: 10,
				open: async (ws, req) => {
					// ws.subscribe("graph/#");
					// Start a file watcher inside the directory
					// ws.publish("graph/temperature", message);
					await fs.ensureDir("./storage");
					setWatcherStatus("🔍\tWatching storage", "green");
					const storageWatcher = await watcher("./storage", e => {
						console.log(e);
					});
					await storageWatcher.start();
				}
			})
			.listen(webSocketPort, token => {
				if (!token) {
					setSocketStatus(
						"💀\tFailed to listen to port " + webSocketPort,
						"red"
					);
					process.exit(1);
				}

				setSocketStatus("🚀\tReady to receive data . . .", "green");
			});

		process.on("SIGINT", () => {
			setRestStatus("⏹️\tShutdown app server", "cyan");
			setSocketStatus("⏹️\tShutdown socket server", "cyan");
			setWatcherStatus("⏹️\tShutdown file watcher", "cyan");

			process.exit();
		});
	}, []);

	return (
		<Box flexDirection="column">
			<Color keyword={socketStatusColor}>
				<Text>{socketStatus}</Text>;
			</Color>
			<Color keyword={restStatusColor}>
				<Text>{restStatus}</Text>;
			</Color>
			<Color keyword={watcherStatusColor}>
				<Text>{watcherStatus}</Text>;
			</Color>
		</Box>
	);
};

export default Main;
