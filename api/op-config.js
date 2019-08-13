import fs from "fs-extra";
import { kebab } from "case";
import path from "path";
import { exec } from "child_process";

export const listConfig = async (req, res) => {
	const { setRestStatus } = req.log;

	const storagePath = path.resolve(`./storage/`);

	const storageExist = await fs.pathExists(storagePath);

	res.writeHead(200, { "Content-Type": "application/json" });

	if (!storageExist) {
		setRestStatus(`😭\tPath '${storagePath} does not exist'`);
		res.end(
			JSON.stringify({
				success: false
			})
		);
		return;
	}

	const configList = await fs.readdir(storagePath);

	setRestStatus(JSON.stringify(configList));
	res.end(
		JSON.stringify({
			success: true,
			configList
		})
	);
};

export const readConfig = async (req, res) => {
	const { setRestStatus } = req.log;

	setRestStatus(JSON.stringify(req.body));
	const { name } = req.body;
	const nameId = kebab(name);

	const storagePath = path.resolve(`./storage/${nameId}`);
	const configPath = path.resolve(`${storagePath}/config.json`);

	const data = await fs.readJSON(configPath);

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			success: true,
			...data
		})
	);
};

export const removeConfig = async (req, res) => {
	const { setRestStatus } = req.log;

	setRestStatus(JSON.stringify(req.body));
	const { name } = req.body;
	const nameId = kebab(name);

	const storagePath = path.resolve(`./storage/${nameId}`);

	await fs.remove(storagePath);

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			success: true
		})
	);
};

export const runConfig = async (req, res) => {
	const { setRestStatus, runFile } = req.log;

	setRestStatus(JSON.stringify(req.body));
	const { name } = req.body;

	const jobEndCallback = () => {
		const nextItem = jobQueue.pop();
		const nameId = kebab(name);

		const storagePath = path.resolve(`./storage/${nameId}`);
		const configPath = path.resolve(`${storagePath}/config.json`);

		exec(`python ${runFile} --config=${configPath}`, (err, stdout, stderr) => {
			jobEndCallback();
		});
	}

	res.writeHead(200, { "Content-Type": "application/json" });
	if (!(await fs.pathExists(configPath))) {
		setRestStatus(`Error: ${configPath} not found`);
		res.end(
			JSON.stringify({
				success: false
			})
		);

		return;
	}

	jobQueue.append(name);
	jobEndCallback();

	res.end(
		JSON.stringify({
			success: true
		})
	);
};

export const createConfig = async (req, res) => {
	const { setRestStatus } = req.log;

	setRestStatus(JSON.stringify(req.body));
	const { name } = req.body;

	const nameId = kebab(name);

	const storagePath = path.resolve(`./storage/${nameId}`);
	const configPath = path.resolve(`${storagePath}/config.json`);

	await fs.ensureDir(storagePath);

	await fs.writeJSON(configPath, req.body);

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			success: true
		})
	);
};
