import React, { useEffect } from "react";
import PropTypes from "prop-types";

import { Text, Color, Box } from "ink";

import uWS from "uWebSockets.js";
import handler from "serve-handler";

import express from "express";
import watcher from "nsfw";

import fs from "fs-extra";
import { exec } from "child_process";
import path from "path";
import { useLogState } from "../core/utils";
import { webSocketPort, staticPort, staticPath } from "../core/config";

import si from "systeminformation";
import { Converter as CSV } from "csvtojson";

/// 🚀 The ultimate toolkits for turbocharging your ML tuning workflow.
const Main = ({ runFile }) => {
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

			return
		}

		const server = express();
		// parse application/json
		server.use(express.json());

		server.post("/create-config", async (req, res) => {
			setRestStatus(JSON.stringify(req.body));
			const { name } = req.body;

			const storagePath = path.resolve(`./storage/${name}`);
			const configPath = path.resolve(`${storagePath}/config.json`);

			await fs.ensureDir(storagePath);

			await fs.writeJSON(configPath, req.body);

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					success: true
				})
			);
		});

		server.post("/run-config", async (req, res) => {
			setRestStatus(JSON.stringify(req.body));
			const { name } = req.body;

			const storagePath = path.resolve(`./storage/${name}`);
			const configPath = path.resolve(`${storagePath}/config.json`);
			exec(
				`python ${runFile} --config=${configPath}`,
				(err, stdout, stderr) => {
					setRestStatus(stdout);
				}
			);

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					success: true
				})
			);
		});

		server.get("/list-config", async (req, res) => {
			const storagePath = path.resolve(`./storage/`);

			const storageExist = await fs.pathExists(storagePath);

			res.writeHead(200, { "Content-Type": "application/json" });

			if (!storageExist) {
				setWatcherStatus(`😭\tPath '${storagePath} does not exist'`);
				res.end(
					JSON.stringify({
						success: false
					})
				);
				return;
			}

			const configList = await fs.readdir(storagePath);

			setWatcherStatus(JSON.stringify(dirs));
			res.end(
				JSON.stringify({
					success: true,
					configList
				})
			);
		});

		server.get("/hw-info", async (req, res) => {
			// Get cpu and memory stats
			const cpu = await si.cpu();
			const cpuCurrSpeed = await si.cpuCurrentspeed();
			const gpus = await si.graphics();
			const memory = await si.mem();
			const specs = {
				cpuCurrentClock: cpu.speed,
				cpuMaxClock: cpu.speedmax,
				memoryUsed: memory.active,
				memoryTotal: memory.total,
				numGpus: gpus.length
			};

			// Get gpu stats
			const query = `nvidia-smi --format=csv --query-gpu=memory.used,memory.free,utilization.gpu`;
			exec(query, (err, result) => {
				if (err) {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(specs));
				} else {
					const Parser = new CSV({
						flatKeys: true
					});

					Parser.fromString(data, (err, result) => {
						if (err) {
							logger.error({ err }, "Failed to parse CSV output");
							console.log(data);
						} else {
							result.forEach(gpu => {
								// Set unsupported returns to an empty string for simplicity
								for (const key in gpu) {
									if (gpu.hasOwnProperty(key)) {
										const value = gpu[key];
										if (value === "[Not Supported]") {
											gpu[key] = "";
										} else {
											if (value === "Enabled") {
												gpu[key] = true;
											} else if (value === "Disabled") {
												gpu[key] = false;
											}
										}
									}
								}

								for (let i = 0; i < specs.numGpus; i++) {
									const gpuSpecs = {
										gpuMemoryUsed: parseInt(
											gpu["memory.used [MiB]"].replace(" MiB", ""),
											10
										),
										gpuMemoryTotal: parseInt(
											gpu["memory.total [MiB]"].replace(" MiB", ""),
											10
										),
										gpuUtilization: parseInt(
											gpu["utilization.gpu [%]"].replace(" %", "")
										)
									};
									specs[`gpu${i}`] = gpuSpecs;
								}

								res.writeHead(200, { "Content-Type": "application/json" });
								res.end(JSON.stringify(specs));
							});
						}
					});
				}
			});
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

Main.propTypes = {
	/// The python training script to be run
	runFile: PropTypes.string.isRequired
};

Main.positionalArgs = ["runFile"];

export default Main;
