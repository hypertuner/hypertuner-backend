import fs from 'fs-extra'

export const getInitialProcess = async (storagePath, progressPath) => {
	const pathExists = await fs.pathExists(progressPath);

	if (pathExists) {
		return fs.readJSON(progressPath);
	}

	const potentialConfigDirs = await fs.readdir(storagePath, {
		withFileTypes: true
	});

	const processStatus = potentialConfigDirs
		.filter(f => f.isDirectory())
		.reduce((p, c) => {
			p[c.name] = "saved";
			return p;
		}, {});

	await fs.writeJSON(progressPath, processStatus);

	return processStatus;
};
