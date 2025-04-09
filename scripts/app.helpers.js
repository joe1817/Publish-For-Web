function getRadioValue(groupName) {
	const radioButtons = document.getElementsByName(groupName);
	for (let i = 0; i < radioButtons.length; i++) {
		if (radioButtons[i].checked) {
			return radioButtons[i].value;
		}
	}
	return null;
}

function getInputOrDefault(id) {
	const tag = document.getElementById(id);
	const val = tag.value || tag.getAttribute("default");
	return val;
}

function splitFilename(name) {
	name = name.endsWith("/") ? name.substring(0, name.length-1) : name;
	const lastDotIndex = name.lastIndexOf(".");
	const lastSlashIndex = name.lastIndexOf("/");

	const dir      = lastSlashIndex !== -1 ? name.substring(0, lastSlashIndex+1) : "";
	const basename = lastDotIndex   !== -1 ? name.substring(lastSlashIndex+1, lastDotIndex) : name.substring(lastSlashIndex+1);
	const ext      = lastDotIndex   !== -1 ? name.substring(lastDotIndex     ) : "";
	return [dir, basename, ext];
}

function safeParseInt(str, def) {
  const parsedValue = parseInt(str, 10);
  return isNaN(parsedValue) ? def : parsedValue;
}

function safeParseFloat(str, def) {
  const parsedValue = parseFloat(str, 10);
  return isNaN(parsedValue) ? def : parsedValue;
}

function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

// allow only certain characters in an "input" event
function filterInput(event, filter) {
	const tag = event.target;
	const input = tag.value;
	const cursorPosition = tag.selectionStart-1;
	const filteredInput = tag.value.replace(filter, "");
	if (filteredInput != input) {
		tag.value = filteredInput;
		tag.selectionStart = cursorPosition;
		tag.selectionEnd = cursorPosition;
	}
}