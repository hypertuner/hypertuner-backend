import React, { useEffect } from "react";
import PropTypes from "prop-types";

import { Text, Color, Box } from "ink";

import uWS from "uWebSockets.js";

import express from "express";
import watcher from "nsfw";

import cors from "cors";

import fs from "fs-extra";
import path from "path";
import { useLogState } from "../core/utils";
import { webSocketPort, staticPort, staticPath } from "../core/config";

import csv from "csvtojson";

import uuid from "uuid/v1";

import { hwInfo } from "../api/hw-info";
import {
	createConfig,
	listConfig,
	readConfig,
	runConfig,
	removeConfig
} from "../api/op-config";
import { kebab } from "case";

const watchMap = new Map();

/// 🚀 The ultimate toolkits for turbocharging your ML tuning workflow.
const Main = ({ runFile, cors: enableCors }) => {
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
		if (!fs.pathExistsSync(path.resolve(`./${runFile}`))) {
			setSocketStatus("⛔\tShutdown all services", "red");
			setRestStatus("⛔\tError!", "red");
			setWatcherStatus(`⛔\t${runFile} does not exist`, "red");

			return;
		}

		const server = express();
		// parse application/json
		server.use(express.json());

		if (enableCors) {
			server.use(cors());
		}

		server.use((req, res, next) => {
			req.log = {
				runFile,
				setSocketStatus,
				setRestStatus,
				setWatcherStatus
			};
			next();
		});

		server.post("/create-config", createConfig);

		server.post("/run-config", runConfig);

		server.post("/remove-config", removeConfig);

		server.post("/read-config", readConfig);

		server.get("/list-config", listConfig);

		server.get("/hw-info", hwInfo);

		server.use(express.static(staticPath));

		server.get("/*", (req, res) => {
			res.sendFile(path.join(staticPath, "/index.html"));
		});

		server.listen(staticPort, () => {
			setRestStatus(
				`🚀\tReady at http://localhost:${staticPort} . . .`,
				"green"
			);
		});

		uWS
			.App()
			.ws("/graph", {
				compression: 0,
				maxPayloadLength: 16 * 1024 * 1024,
				// idleTimeout: 10,
				open: async (ws, req) => {
					// ws.subscribe("graph/#");
					// Start a file watcher inside the directory
					// ws.publish("graph/temperature", message);
					// await fs.ensureDir("./storage");
					// setWatcherStatus("🔍\tWatching storage", "green");
					// const storageWatcher = await watcher("./storage", e => {
					// 	console.log(e);
					// });
					// await storageWatcher.start();
				},
				message: async (ws, message, isBinary) => {
					const data = Buffer.from(message).toString();
					setSocketStatus(data);

					const args = JSON.parse(data);

					const { action } = args;

					switch (action) {
						case "watch": {
							const { name } = args;
							const nameId = kebab(name);
							const watchId = uuid();

							const storagePath = path.resolve(`./storage/${nameId}`);
							const configPath = path.resolve(`${storagePath}/config.json`);
							const graphPath = path.resolve(`${storagePath}/logs.csv`);

							const [configExist, graphExist] = await Promise.all([
								fs.pathExists(configPath),
								fs.pathExists(graphPath)
							]);

							if (!configExist) {
								ws.send(
									JSON.stringify({
										err: `config-not-found`
									})
								);
								return;
							}

							if (graphExist) {
								const graphData = await csv({
									headers: ['x', 'y']
								}).fromFile(graphPath);

								ws.send(
									JSON.stringify({
										success: true,
										watchId,
										type: "watch-init",
										graphData
									})
								);
							}

							const storageWatcher = await watcher(storagePath, events => {
								// TODO: handle new data and filter out our graph file

								ws.send(
									JSON.stringify({
										success: true,
										watchId,
										type: "watch-events",
										events
									})
								);
							});

							await storageWatcher.start();

							watchMap.set(watchId, storageWatcher);

							break;
						}
						case "unwatch": {
							const { watchId: stopWatchId } = args;

							await watchMap[stopWatchId].stop();

							watchMap.delete(stopWatchId);

							ws.send(
								JSON.stringify({
									success: true,
									type: "watch-stop",
									watchId: stopWatchId
								})
							);
							break;
						}
						default:
							break;
					}
				}
			})
			.ws("/terminal", {
				open: async (ws, req) => {},
				message: (ws, message, isBinary) => {}
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

Main.defaultProps = {
	cors: false
};

Main.propTypes = {
	/// The python training script to be run
	runFile: PropTypes.string.isRequired,
	/// Enable all cors
	cors: PropTypes.bool
};

Main.positionalArgs = ["runFile"];

export default Main;
