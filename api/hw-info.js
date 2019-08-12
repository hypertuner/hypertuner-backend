import si from "systeminformation";
import { Converter as CSV } from "csvtojson";
import { exec } from "child_process";

export const hwInfo = async (req, res) => {

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
	res.writeHead(200, { "Content-Type": "application/json" });
	exec(query, (err, result) => {
		if (err) {
			res.end(
				JSON.stringify({
					success: false,
					...specs
				})
			);
			return;
		}
		const Parser = new CSV({
			flatKeys: true
		});

		Parser.fromString(data, (err, result) => {
			if (err) {
				res.end(
					JSON.stringify({
						success: false,
						...data
					})
				);
				return;
			}
			result.forEach(gpu => {
				// Set unsupported returns to an empty string for simplicity

				for (const key in gpu) {
					if (gpu.hasOwnProperty(key)) {
						const value = gpu[key];
						switch (value) {
							case "Enabled":
								gpu[key] = true;

								break;
							case "Disabled":
								gpu[key] = false;

								break;
							case "[Not Supported]":
							default:
								gpu[key] = "";
								break;
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
			});
			res.end(
				JSON.stringify({
					success: true,
					...specs
				})
			);
		});
	});
};
