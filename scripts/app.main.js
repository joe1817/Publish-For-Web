var DateTime = luxon.DateTime;

// MIME types for output formats
const MIME = {
	".jpg" : "image/jpeg",
	".jpeg": "image/jpeg",
	".png" : "image/png",
	".webp": "image/webp",
	".zip" : "application/zip",
};











function* getNewFilename(file, newMetadata, oldMetadata) {
	const val = getRadioValue("option-filename");
	let [dir, basename, ext] = splitFilename(file.webkitRelativePath || file.name);

	if (val === "filename-whitespace") {
		basename = basename.trim().toLowerCase().replaceAll(/ +/g, "-");
	} else if (val === "filename-template") {
		let template = getInputOrDefault("filename-template-text");

		// default params
		template = template.replaceAll(/(?<!%)%(?![fFGxwhqdDrR%])/g, "%%"); // lone % is taken literally
		template = template.replaceAll(/%d(?!{)/g, "%d{yyyyLLdd_HHmmss}");  // default Date format
		template = template.replaceAll(/%D(?!{)/g, "%d{yyyyLLdd_HHmmss}");  // default Date format
		template = template.replaceAll(/%r(?!{)/g, "%r{4}");                // default random count
		template = template.replaceAll(/%R(?!{)/g, "%R{4}");                // default random count

		let out = "";
		let command = "", arg = "";

		for (let i = 0; i < template.length; i++) {
			let c = template.charAt(i);
			if (command) {
				if (c === "}") {
					if (command === "r") {
						arg = safeParseInt(arg, 1);
						out += Math.floor(Math.random() * 10**arg);
					} else if (command === "R") {
						arg = safeParseInt(arg, 1);
						const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
						for (let j = 0; j < arg; j++) {
							const randomIndex = Math.floor(Math.random() * characters.length);
							out += characters.charAt(randomIndex);
						}
					} else if (command === "d") {
						let tmp = getDateTaken(file, oldMetadata.exif).dateTimeOriginal;
						tmp = DateTime.fromJSDate(tmp);
						tmp = tmp.toFormat(arg);
						out += tmp;
					} else if (command === "D") {
						out += DateTime.now().toFormat(arg);
					}
					command = "";
					arg = "";
				} else {
					arg += c;
				}
			} else if (c == "%") {
				i++;
				if (i === template.length) break;
				command = template.charAt(i);
				if (command === "f") {
					out += basename.trim().toLowerCase().replaceAll(/ +/g, "-");
					command = "";
				} else if (command === "F") {
					out += basename.trim().replaceAll(/ +/g, "-");
					command = "";
				} else if (command === "G") {
					out += basename;
					command = "";
				} else if (command === "x") {
					out += ext.substring(1); // old extension
					command = "";
				} else if (command === "w") {
					out += newMetadata.width;
					command = "";
				} else if (command === "h") {
					out += newMetadata.height;
					command = "";
				} else if (command === "q") {
					out += parseInt(100*getNewQuality());
					command = "";
				} else if (command === "d") {
					i++;
				} else if (command === "D") {
					i++;
				} else if (command === "r") {
					i++;
				} else if (command === "R") {
					i++;
				} else if (command === "%") {
					out += "%";
					command = "";
				} else {
					// error, uncrecognized command
					throw new Error("Uncrecognized command in template");
				}
			} else {
				out += c;
			}
		}

		basename = out;
	}
	const format = getNewFormat(file, oldMetadata);
	if (format == "image/jpeg") {
		ext = ".jpg";
	} else {
		ext = "." + format.substring(6);
	}

	for (let i = 0; ; i++) {
		if (i)
			yield [dir, basename, "-", i, ext].join("");
		else
			yield [dir, basename, ext].join("");
	}
}

function getNewDimensions(metadata) {
	let cropt     = parseInt(getInputOrDefault("image-cropt"))
	let cropb     = parseInt(getInputOrDefault("image-cropb"))
	let cropl     = parseInt(getInputOrDefault("image-cropl"))
	let cropr     = parseInt(getInputOrDefault("image-cropr"))
	let maxWidth  = parseInt(document.getElementById("image-maxwidth").value);
	let maxHeight = parseInt(document.getElementById("image-maxheight").value);
	let newWidth  = metadata.width - cropl - cropr;
	let newHeight = metadata.height - cropt - cropb;

	if (isNaN(maxWidth)) {
		maxWidth = newWidth;
	}
	if (isNaN(maxHeight)) {
		maxHeight = newHeight;
	}

	if (newWidth > maxWidth) {
		newHeight = newHeight * maxWidth / newWidth;
		newWidth = maxWidth;
	}
	if (newHeight > maxHeight) {
		newWidth = newWidth * maxHeight / newHeight;
		newHeight = maxHeight;
	}
	newWidth = Math.floor(newWidth + 0.0001);
	newHeight = Math.floor(newHeight + 0.0001);

	return [cropt, cropb, cropl, cropr, newWidth, newHeight];
}

function getNewFormat(file, metadata) {
	const val = getRadioValue("option-filetype");
	if (val === "filetype-jpg") {
		return "image/jpeg";
	} else if (val === "filetype-png") {
		return "image/png";
	} else if (val === "filetype-webp") {
		if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
			throw new Error("WEBP not supported"); // safari does not support webp
		return "image/webp";
	} else if (val === "filetype-match") {
		return metadata.type;
		// match file extension of input
		/*
		const [dir, basename, ext] = splitFilename(file.name); //drag-and-dropped files sometimes don't have a type, need to look at file ext
		let mime = MIME[ext];
		if (mime === undefined) {
			mime = "image/jpeg";
		}
		if (mime === "image/webp" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
			mime = "image/jpeg";
		}
		return mime;
		*/
	}
}

function getNewQuality() {
	let quality = parseFloat(getInputOrDefault("jpg-quality-text"));
	quality = clamp(quality, 0.0, 1.0);
	return quality;
}

function getNewMetadata(file, metadata, width, height) {
	const newMetadata = {};
	newMetadata.type   = metadata.type;

	const artist    = document.getElementById("meta-artist").value;
	const title     = document.getElementById("meta-title").value;
	const copyright = document.getElementById("meta-copyright").value;
	const checked = document.getElementById("meta-date").checked;
	let dateTaken   = {};
	if (checked) {
		dateTaken = getDateTaken(file, metadata.exif);
	}
	newMetadata.exif = {
		artist             : artist,
		title              : title,
		copyright          : copyright,
		dateTimeOriginal   : dateTaken.dateTimeOriginal,
		timeZoneOffset     : dateTaken.timeZoneOffset,
		subSecTimeOriginal : dateTaken.subSecTimeOriginal,
	};

	return newMetadata;
}

function getDateTaken(file, metadata) {

	// 1. Look for Date in EXIF

	if (metadata && metadata.dateTimeOriginal) {
		return {
			dateTimeOriginal   : metadata.dateTimeOriginal,
			timeZoneOffset     : metadata.timeZoneOffset,     // can be undefined
			subSecTimeOriginal : metadata.subSecTimeOriginal,
		}
	}

	// 2. Look for Date in file name

	let dateTimeOriginal;
	let timeZoneOffset;
	let subSecTimeOriginal;

	const [dir, basename, ext] = splitFilename(file.name);
	const found = basename.replaceAll(/[^\d]/g, " ").trim().match(/^(\d{8}) *(\d{6}) *(\d{3})?$/);
	if (found !== null) {
		const dayNumber = found[1], timeNumber = found[2], msNumber = found[3] || "0";
		const year   = parseInt(dayNumber.substring(0, 4));
		const month  = parseInt(dayNumber.substring(4, 6)) - 1; // Months are 0-indexed
		const day    = parseInt(dayNumber.substring(6, 8));
		const hour   = parseInt(timeNumber.substring(0, 2));
		const minute = parseInt(timeNumber.substring(2, 4));
		const second = parseInt(timeNumber.substring(4, 6));
		const ms     = parseInt(msNumber);
		dateTimeOriginal   = new Date(year, month, day, hour, minute, second);
		timeZoneOffset     = -dateTimeOriginal.getTimezoneOffset(); // zero is a valid value
		subSecTimeOriginal =  dateTimeOriginal.getMilliseconds();
		console.log("found filename date");
		return {
			dateTimeOriginal   : dateTimeOriginal,
			timeZoneOffset     : timeZoneOffset,
			subSecTimeOriginal : subSecTimeOriginal,
		}
	}

	// 3. Get Date from Last Modified Time

	dateTimeOriginal   = new Date(file.lastModified);
	timeZoneOffset     = -dateTimeOriginal.getTimezoneOffset();
	subSecTimeOriginal =  dateTimeOriginal.getMilliseconds();
	console.log("using last modified date");
	return {
		dateTimeOriginal   : dateTimeOriginal,
		timeZoneOffset     : timeZoneOffset,
		subSecTimeOriginal : subSecTimeOriginal,
	}
}











function processFiles(f) {
	if (f.length == 1 && !f[0].webkitRelativePath.includes("/")) {
		processSingle(f[0]);
	} else {
		processMultiple(f);
	}
}

function processSingle(file) {
	console.log("beginning file: " + file.name);
	return readMetadata(file)
	.then(metadata => {
		if (!metadata.type)
			throw new Error("Unsupported file type");

		let newType = getNewFormat(file, metadata);
		let newDims = getNewDimensions(metadata);
		let newQuality = getNewQuality(file);

		return resizeImage(file, metadata, newType, newDims, newQuality);
	})
	.then(result => {
		result.newMetadata = getNewMetadata(result.file, result.metadata, result.newWidth, result.newHeight);

		return insertMetadata(result.blob, result.newMetadata)
		.then(newBlob => {
			result.blob = newBlob;
			return result;
		});
	})
	.then(result => {
		const newName = getNewFilename(result.file, result.newMetadata, result.metadata).next().value;
		console.log("renaming to: " + newName);
		saveAs(result.blob, newName);
	})
	.catch(err => {
		console.log(err);
	});
}

function processMultiple(files) {
	if (!files.length) return;

	const zip = new JSZip();
	const usedFilenames = new Set();

	const message = document.getElementById("message");
	const messageText = document.getElementById("message-text");
	const messageButton = document.getElementById("message-button");
	const spinner = document.getElementById("spinner");

	if (!spinner.classList.contains("hidden")) return; // another job is running

	let error = false;

	console.log("input: " + files.length);
	messageText.textContent = "Reading files...";
	spinner.classList.remove("hidden");
	message.classList.remove("hidden");

	Promise.all(
		Array.from(files).map(file => {
			console.log("beginning file: " + file.name);

			return readMetadata(file)
			.then(metadata => {
				if (!metadata.type)
					throw new Error("Unsupported file type");

				let newType = getNewFormat(file, metadata);
				let newDims = getNewDimensions(metadata);
				let newQuality = getNewQuality(file);

				return resizeImage(file, metadata, newType, newDims, newQuality);
			})
			.then(result => {
				result.newMetadata = getNewMetadata(result.file, result.metadata, result.newWidth, result.newHeight);

				return insertMetadata(result.blob, result.newMetadata)
				.then(newBlob => {
					result.blob = newBlob;
					return result;
				});
			})
			.then(result => {
				// get unique file name
				let newName;

				for(newName of getNewFilename(result.file, result.newMetadata, result.metadata)) {
					if (!usedFilenames.has(newName)) {
						usedFilenames.add(newName);
						break;
					}
				}

				console.log("adding file: " + newName);
				zip.file(newName, result.blob);
			})
			.catch(err => {
				console.log("error: " + file.name);
				console.log(err);
				error = true;
			});
		})
	)
	.then(() => {
		console.log("generating zip");
		messageText.textContent = "Zipping files...";
		zip.generateAsync({ type: "blob", compression: "STORE" })
		.then(content => {
			saveAs(content, "images.zip");

			if (error) {
				messageText.textContent = "Some images failed. Make sure they are all valid images.";
			} else {
				messageText.textContent = "Your new images were downloaded.";
			}
			spinner.classList.add("hidden");
			messageButton.textContent = "OK";
		});
	})
	.catch(err => {
		messageText.textContent = "" + err;
		spinner.classList.add("hidden");
		messageButton.textContent = "OK";
		console.log(err);
	});
}

function resizeImage(file, metadata, newType, newDims, newQuality) {

	[cropt, cropb, cropl, cropr, newWidth, newHeight] = newDims;

	return new Promise((resolve, reject) => {
		if (cropt + cropb + cropl + cropr == 0 && newWidth == metadata.width && newHeight == metadata.height && newType == metadata.type && (newType == "image/png" || newQuality == 1)) {
			removeMetadata(file, metadata.type)
			.then(removed => {
				if (removed) {
					console.log("copying image data");
					resolve({
						file     : file,
						metadata : metadata,
						blob     : removed,
						width    : metadata.width,
						height   : metadata.height,
					});
				}
			});
		}

		const url = URL.createObjectURL(file);
		const img = new Image();

		img.onload = () => {
			URL.revokeObjectURL(url);

			// Create a temporary canvas to render the processed image
			const canvas = document.createElement("canvas");

			if (cropt + cropb + cropl + cropr > 0 || newWidth != metadata.width || newHeight != metadata.height) {
				// Wrap canvas in a Fabric.js canvas
				const fcanvas = new fabric.Canvas(canvas, {
					imageSmoothingEnabled: false,
					enableRetinaScaling: false,
				});
				fcanvas.setWidth(newWidth);
				fcanvas.setHeight(newHeight);

				// Apply cropping
				const croppedImage = new fabric.Image(img, {
					left: 0,
					top: 0,
					cropX: cropl,
					cropY: cropt,
					width: img.width - cropl - cropr,
					height: img.height - cropt - cropb
				});

				// Apply scaling
				croppedImage.scale(newWidth / (img.width - cropl - cropr));

				// Apply filter
				const lanczosFilter = new fabric.Image.filters.Resize({
					scaleX: 1,
					scaleY: 1,
					resizeType: "lanczos",
					lanczosLobes: 3,
				});
				croppedImage.filters = [lanczosFilter]; // TODO WEBGL deprecation warning
				croppedImage.applyFilters();

				// Render
				fcanvas.add(croppedImage);
				fcanvas.renderAll();
			} else {
				canvas.width = img.width;
				canvas.height = img.height;
				const ctx = canvas.getContext("2d");
				ctx.drawImage(img, 0, 0);
			}

			// Convert the fcanvas to a Blob
			console.log("converting image: " + newType + " " + newQuality);
			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve({
							file     : file,
							metadata : metadata,
							blob     : blob,
							width    : newWidth,
							height   : newHeight,
						});
					} else {
						reject(new Error("Failed to create Blob."));
					}
				},
				newType, newQuality
			);
		}

		img.onerror = (error) => {
			URL.revokeObjectURL(url);
			reject(error);
		}

		img.src = url;
	});
}

function saveAs(content, filename) {
	const [dir, basename, ext] = splitFilename(filename);
	const mime = MIME[ext];
	console.log("downloading: " + mime);
	const file = new File([content], filename, { type: mime });
	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click(); // TODO? only download zip - certain characters, including %, will be replaced with _ unless the images are in a .zip. Also, WEBP images will sometimes open in a new tab when downloaded.
	URL.revokeObjectURL(url);
}











// target of HTML buttons
function filePicker(dirs) {
	if (dirs) {
		document.getElementById("input-dirs").click();
	} else {
		document.getElementById("input-files").click();
	}
}

fileInputHandler = (event) => {
	try {
		processFiles(event.target.files);
	} finally {
		event.target.value = "";
	}
}

filePasteHandler = (event) => {
	console.log("Pasted " + event.clipboardData.files.length + " files.");
	if (event.clipboardData.files.length) {
		processFiles(event.clipboardData.files);
	} else {
		alert("Unable to read image data. If this problem persists, try drag-and-dropping files onto the page instead.");
	}
}

fileDropHandler = (event) => {
	event.preventDefault();
	const items = event.dataTransfer.items;
	const files = [];

	let count = items.length;

	const onFile = (file) => {
		files.push(file);
		if (!--count) processFiles(files);
	}
	const onEntries = (entries) => {
		count += entries.length;
		for (const entry of entries) {
			scanFiles(entry);
		}
		if (!--count) processFiles(files);
	};
	const onErr = (err) => {
		console.log(err);
		if (!--count) processFiles(files);
	}

	// can scan subdriectories with FileSystemDirectoryEntry, but not with File
	const scanFiles = (entry) => {
		if (entry.isFile) {
			entry.file(onFile, onErr);
		} else {
			entry.createReader().readEntries(onEntries, onErr);
		}
	}

	for (const item of items) {
		const entry = item.webkitGetAsEntry();
		if (entry) {
			scanFiles(entry);
		} else {
			if (!--count) processFiles(files);
		}
	}
}

// reset all inputs to default values
function resetInputs() {
	document.querySelectorAll("input").forEach(tag => {
		if (tag.hasAttribute("default")) {
			if (tag.type == "radio") {
				tag.checked = true;
			} else {
				tag.value = tag.getAttribute("default");
			}
		}
	});
	document.getElementById("meta-date").checked = false;
	resetEnabled();
}

// reset which inputs are enabled based on all current input values
function resetEnabled() {
	document.getElementById("filename-template-text").disabled = getRadioValue("option-filename") != "filename-template";

	const filetype = getRadioValue("option-filetype");
	const w = document.getElementById("image-maxwidth");
	const h = document.getElementById("image-maxheight");
	document.getElementById("jpg-quality-text").disabled = !["filetype-jpg", "filetype-webp", "filetype-match"].includes(filetype);
	//w.disabled = h.disabled = filetype == "filetype-copydata";
}

window.addEventListener("DOMContentLoaded", () => {
	// hide the warning about javascript being disabled
	document.getElementById("js-off").classList.toggle("hidden");
	document.getElementById("js-on").classList.toggle("hidden");
	
	// hide info specific to other OS's
	if (window.navigator.userAgent.includes("Win")) {
		for (const e of document.querySelectorAll(".hide-windows")) {
			e.style.display = "none";
		}
	} else {
		for (const e of document.querySelectorAll(".hide-linux")) {
			e.style.display = "none";
		}
	}
	
	// set file input handlers
	document.getElementById("input-files").oninput = fileInputHandler;
	document.getElementById("input-dirs").oninput = fileInputHandler;
	document.addEventListener('paste', filePasteHandler);
	document.addEventListener("dragover", (event) => {
		event.preventDefault();
	});
	document.addEventListener("drop", fileDropHandler, false);

	// show/hide info panel when interacting with template input
	document.getElementById("filename-template-text").addEventListener("focus", (event) => {
		document.getElementById("info-panel").classList.remove("hidden");
	});
	document.getElementById("filename-template-text").addEventListener("blur", (event) => {
		setTimeout(() => {
			document.getElementById("info-panel").classList.toggle("hidden");
		}, 100);
	});

	// set allowed characters in inputs
	document.getElementById("filename-template-text").addEventListener("input", (event) => {
		filterInput(event, /[\x00-\x1F\x7F-\x9F\\\/:*?"<>|]/g); // filename-safe chars only (exclude control characters and Windows-forbidden chars)
	});
	document.getElementById("meta-artist").addEventListener("input", (event) => {
		filterInput(event, /[^ -~]/g); // printable ascii only
	});
	document.getElementById("meta-title").addEventListener("input", (event) => {
		filterInput(event, /[^ -~]/g); // printable ascii only
	});
	document.getElementById("meta-copyright").addEventListener("input", (event) => {
		filterInput(event, /[^ -~]/g); // printable ascii only
	});
	document.getElementById("jpg-quality-text").addEventListener("input", (event) => {
		filterInput(event, /[^0-9.]/g); // rational numbers only
	});
	document.getElementById("image-cropt").addEventListener("input", (event) => {
		filterInput(event, /[^0-9]/g); // integers only
	});
	document.getElementById("image-cropb").addEventListener("input", (event) => {
		filterInput(event, /[^0-9]/g); // integers only
	});
	document.getElementById("image-cropl").addEventListener("input", (event) => {
		filterInput(event, /[^0-9]/g); // integers only
	});
	document.getElementById("image-cropr").addEventListener("input", (event) => {
		filterInput(event, /[^0-9]/g); // integers only
	});
	document.getElementById("image-maxwidth").addEventListener("input", (event) => {
		filterInput(event, /[^0-9]/g); // integers only
	});
	document.getElementById("image-maxheight").addEventListener("input", (event) => {
		filterInput(event, /[^0-9]/g); // integers only
	});

	// set input to [blank] when selecting certain inputs
	document.getElementById("image-cropt").addEventListener("focus", (event) => {
		event.target.value = "";
	});
	document.getElementById("image-cropb").addEventListener("focus", (event) => {
		event.target.value = "";
	});
	document.getElementById("image-cropl").addEventListener("focus", (event) => {
		event.target.value = "";
	});
	document.getElementById("image-cropr").addEventListener("focus", (event) => {
		event.target.value = "";
	});
	document.getElementById("image-maxwidth").addEventListener("focus", (event) => {
		event.target.value = "";
	});
	document.getElementById("image-maxheight").addEventListener("focus", (event) => {
		event.target.value = "";
	});

	// fill certain tags with default value if they are left blank
	document.querySelectorAll("input").forEach(tag => {
		if (tag.hasAttribute("fill-blank")) {
			tag.addEventListener("blur", (event) => {
				if (tag.value === "") {
					tag.value = tag.getAttribute("default");
				}
			});
		}
	});
	
	// if an input gets disabled, change its value to [blank]
	// when it's enabled, change its value to [default]
	const dimObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.attributeName === "disabled") {
				if (mutation.target.disabled) {
					mutation.target.value = "";
				} else {
					mutation.target.value = mutation.target.getAttribute("default");
				}
			}
		});
	});
	dimObserver.observe(document.getElementById("image-maxwidth"), { attributes: true });
	dimObserver.observe(document.getElementById("image-maxheight"), { attributes: true });

	// changing radio inputs should change what other inputs anr enabled
	document.querySelectorAll("input[type='radio']").forEach(tag => {
		tag.addEventListener("input", (event) => {
			resetEnabled();
		});
	});

	// escape key will reset everything
	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			resetInputs();
		}
	});

	// reset what's enabled based on default values
	resetEnabled();
});
