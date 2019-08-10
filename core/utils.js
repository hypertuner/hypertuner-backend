import { useState } from "react";

export const useLogState = (
	defaultTag = "log",
	defaultValue = "hello",
	defaultColor = "white"
) => {
	const [tag, setTag] = useState(defaultTag);
	const [log, setLogRaw] = useState(`${tag}\t | ${defaultValue}`);

	const setLog = s => setLogRaw(`${tag}\t | ${s}`);

	const [color, setColor] = useState(defaultColor);

	const setConfig = (v, c, t) => {
		if (t !== undefined) setTag(t);
		if (c !== undefined) setColor(c);
		setLog(v);
	};

	return [log, color, setConfig];
};