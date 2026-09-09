var har;
var reqs = [];
var selectedReq;
var selectedIndex = -1;
var visibleIndicies = [];

var handledKeystroke = false;
var keystrokeTimeout = true;
const vscode = acquireVsCodeApi();

function getProtocolGroup(url) {
    var protocolMatch = /^([a-z][a-z0-9+.-]*):/i.exec(url || "");
    if (!protocolMatch) {
        return "other";
    }
    var protocol = protocolMatch[1].toLowerCase();
    if (protocol == "ws" || protocol == "wss") {
        return "websocket";
    }
    if (protocol == "http" || protocol == "https") {
        return protocol;
    }
    return "other";
}

function getHttpVersionGroup(reqItem) {
    var version = (reqItem && reqItem.request && reqItem.request.httpVersion) || "";
    if (/^(?:HTTP\/?)?2(?:\.0)?$/i.test(version) || /^h2$/i.test(version)) {
        return "http2";
    }
    if (/^(?:HTTP\/?)?1(?:\.\d+)?$/i.test(version) || /^h1$/i.test(version)) {
        return "http1";
    }
    return "other";
}

function getMethodGroup(method) {
    var normalizedMethod = String(method || "").toUpperCase();
    var standardMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "CONNECT", "TRACE"];
    return standardMethods.includes(normalizedMethod) ? normalizedMethod : "other";
}

function getStatusGroup(status) {
    var statusCode = Number(status);
    if (!Number.isFinite(statusCode) || statusCode < 100 || statusCode >= 600) {
        return "other";
    }
    return Math.floor(statusCode / 100) + "xx";
}

function getContentGroup(mimeType) {
    var normalizedMimeType = String(mimeType || "").toLowerCase().split(";", 1)[0].trim();
    if (normalizedMimeType.includes("json")) {
        return "json";
    }
    if (normalizedMimeType == "text/html" || normalizedMimeType == "application/xhtml+xml") {
        return "html";
    }
    if (normalizedMimeType.includes("xml")) {
        return "xml";
    }
    if (normalizedMimeType.includes("javascript") || normalizedMimeType.includes("ecmascript")) {
        return "javascript";
    }
    if (normalizedMimeType.startsWith("image/")) {
        return "image";
    }
    if (normalizedMimeType.startsWith("audio/") || normalizedMimeType.startsWith("video/")) {
        return "media";
    }
    if (normalizedMimeType.startsWith("text/")) {
        return "text";
    }
    return "binary";
}

function getRequestDomain(url) {
    try {
        return new URL(url).host;
    } catch (error) {
        var endpointMatch = /^[^:]*:\/\/([^/]+)/.exec(url || "");
        return endpointMatch ? endpointMatch[1] : "";
    }
}

function getApplicationInfo(reqItem) {
    var app = reqItem && reqItem._app;
    if (!app) {
        return { key: "__none__", label: "未标注" };
    }
    var key = String(app.id || app.name || "__none__");
    var label = String(app.name || app.id || "未标注");
    return { key: key, label: label };
}

function matchesSearchText(value, query, mode) {
    var normalizedValue = String(value || "").toLowerCase();
    var normalizedQuery = String(query || "").toLowerCase();
    if (mode == "startsWith") {
        return normalizedValue.startsWith(normalizedQuery);
    }
    if (mode == "equals") {
        return normalizedValue == normalizedQuery;
    }
    return normalizedValue.includes(normalizedQuery);
}

function matchesFilterGroups(filterValues, activeFilters) {
    for (var filterGroup in activeFilters) {
        if (!activeFilters[filterGroup].includes(filterValues[filterGroup])) {
            return false;
        }
    }
    return true;
}

function clampInspectorWidth(width, layoutWidth) {
    return Math.max(280, Math.min(Number(width) || 0, Math.max(280, Number(layoutWidth) - 280)));
}

function getDisplayRequestId(entity) {
    return String((Number(entity && entity.index) || 0) + 1);
}

function toggleInspectorPanelState(state, panelName) {
    var requestExpanded = state.requestExpanded !== false;
    var responseExpanded = state.responseExpanded !== false;
    if (panelName == "request") {
        requestExpanded = !requestExpanded;
    } else if (panelName == "response") {
        responseExpanded = !responseExpanded;
    }
    if (!requestExpanded && !responseExpanded) {
        if (panelName == "request") {
            responseExpanded = true;
        } else {
            requestExpanded = true;
        }
    }
    return { requestExpanded: requestExpanded, responseExpanded: responseExpanded };
}

var inspectorPanelState = { requestExpanded: true, responseExpanded: true };

function applyInspectorPanelState() {
    var requestExpanded = inspectorPanelState.requestExpanded;
    var responseExpanded = inspectorPanelState.responseExpanded;
    $(".inspector-panel").each(function () {
        var panelName = $(this).attr("data-panel");
        var expanded = panelName == "request" ? requestExpanded : responseExpanded;
        var otherExpanded = panelName == "request" ? responseExpanded : requestExpanded;
        $(this).toggleClass("collapsed", !expanded);
        if (!expanded) {
            this.style.flex = "0 0 34px";
        } else if (!otherExpanded) {
            this.style.flex = "1 1 auto";
        } else {
            this.style.flex = "";
        }
        $(this).find(".inspector-panel-toggle").attr("aria-expanded", String(expanded));
    });
}

function toggleInspectorPanel(panelName) {
    inspectorPanelState = toggleInspectorPanelState(inspectorPanelState, panelName);
    applyInspectorPanelState();
}

function getRawRequestTarget(url) {
    try {
        var parsedURL = new URL(url);
        return (parsedURL.pathname || "/") + (parsedURL.search || "");
    } catch (error) {
        return url || "/";
    }
}

function formatRawRequest(reqItem) {
    var request = reqItem && reqItem.request || {};
    var method = request.method || "GET";
    var version = request.httpVersion || "HTTP/1.1";
    var lines = [method + " " + getRawRequestTarget(request.url) + " " + version];
    var headers = Array.isArray(request.headers) ? request.headers : [];
    for (var i = 0; i < headers.length; i++) {
        lines.push(String(headers[i].name || "") + ": " + String(headers[i].value || ""));
    }
    var body = request.postData && request.postData.text || "";
    return lines.join("\n") + "\n\n" + body;
}

function formatRawResponse(reqItem, content) {
    var response = reqItem && reqItem.response || {};
    var request = reqItem && reqItem.request || {};
    var version = request.httpVersion || "HTTP/1.1";
    var status = response.status == null ? "" : response.status;
    var statusText = response.statusText || "";
    var lines = [version + " " + status + " " + statusText].filter(function (line) { return line.trim().length > 0; });
    var headers = Array.isArray(response.headers) ? response.headers : [];
    for (var i = 0; i < headers.length; i++) {
        lines.push(String(headers[i].name || "") + ": " + String(headers[i].value || ""));
    }
    return lines.join("\n") + "\n\n" + (content || "");
}

function formatHex(text) {
    var bytes = [];
    var source = String(text || "");
    for (var i = 0; i < source.length; i++) {
        var code = source.charCodeAt(i);
        if (code < 128) {
            bytes.push(code);
        } else {
            var encoded = unescape(encodeURIComponent(source.charAt(i)));
            for (var byteIndex = 0; byteIndex < encoded.length; byteIndex++) {
                bytes.push(encoded.charCodeAt(byteIndex));
            }
        }
    }
    var lines = [];
    for (var offset = 0; offset < bytes.length; offset += 16) {
        var lineBytes = bytes.slice(offset, offset + 16);
        lines.push(offset.toString(16).toUpperCase().padStart(4, "0") + "  " + lineBytes.map(function (byte) {
            return byte.toString(16).toUpperCase().padStart(2, "0");
        }).join(" "));
    }
    return lines.join("\n");
}

function renderRawViews() {
    $(".raw-view-tab").off().on("click", function () {
        var panel = $(this).closest(".inspector-panel");
        panel.find(".raw-view-tab").removeClass("selected");
        $(this).addClass("selected");
        panel.find(".raw-code").attr("data-raw-mode", $(this).attr("data-raw-mode"));
        renderRawViews();
    });
    if (!selectedReq) {
        return;
    }
    $(".raw-code").each(function () {
        var source = $(this).attr("data-raw-source");
        var raw = source == "request" ? selectedReq.rawRequest : selectedReq.rawResponse;
        var mode = $(this).attr("data-raw-mode") || "text";
        $(this).html((mode == "hex" ? formatHex(raw) : raw).toString().toHtmlEntities());
    });
}

function runSearch() {
    while (visibleIndicies.length > 0) {
        visibleIndicies.pop();
    }
    var selectedDomain = $(".domain-filter").val() || "";
    var selectedApplication = $(".application-filter").val() || "";
    var query = $(".search").val() || "";
    var searchMode = $(".search-mode").val() || "contains";
    var searchField = $(".search-field").val() || "all";
    var activeFilters = {};
    $(".quick-filter.selected").each(function () {
        var filter = $(this).attr("data-filter");
        if (filter != "all") {
            var group = $(this).attr("data-filter-group");
            if (!activeFilters[group]) {
                activeFilters[group] = [];
            }
            activeFilters[group].push(filter);
        }
    });

    var i = -1;
    $(".request-items .request-item").each(function () {
        i++;
        var entity = reqs[i];
        var filterValues = {
            protocol: entity.protocolGroup,
            "http-version": entity.httpVersionGroup,
            method: entity.methodGroup,
            content: entity.contentGroup,
            status: entity.statusGroup
        };
        if (selectedDomain && entity.domain != selectedDomain) {
            $(this).hide();
            return;
        }
        if (selectedApplication && entity.application != selectedApplication) {
            $(this).hide();
            return;
        }
        if (!matchesFilterGroups(filterValues, activeFilters)) {
            $(this).hide();
            return;
        }
        var searchValues = {
            all: [entity.fullURL, entity.method, entity.domain, entity.applicationLabel, entity.status, entity.mimeType, entity.contentShort].join(" "),
            url: entity.fullURL,
            request: [entity.method, entity.fullURL, entity.requestText].join(" "),
            response: [entity.status, entity.mimeType, entity.contentShort, entity.responseText].join(" ")
        };
        if (query.length > 0 && !matchesSearchText(searchValues[searchField], query, searchMode)) {
            $(this).hide();
            return;
        }
        $(this).show();
        visibleIndicies.push(i);
    });
}

function getNextValue(thisIndex, higher) {
    if (higher) {
        for (i = 0; i < visibleIndicies.length; i++) {
            if (visibleIndicies[i] > thisIndex) {
                return visibleIndicies[i];
            }
        }
    } else {
        for (i = visibleIndicies.length - 1; i >= 0; i--) {
            if (visibleIndicies[i] < thisIndex) {
                return visibleIndicies[i];
            }
        }
    }
    return -1;
}

function closeInspector() {
    selectedReq = null;
    selectedIndex = -1;
    inspectorPanelState = { requestExpanded: true, responseExpanded: true };
    $(".main-layout").removeClass("has-inspector resizing");
    $(".request-inspector").removeClass("ready");
    $(".request-item.selected").removeClass("selected");
    applyInspectorPanelState();
}

function setupInspectorResizer() {
    var splitter = document.querySelector(".inspector-splitter");
    if (!splitter || splitter.dataset.bound == "true") {
        return;
    }
    splitter.dataset.bound = "true";

    function updateWidth(layout, width) {
        var clampedWidth = clampInspectorWidth(width, layout.getBoundingClientRect().width);
        layout.style.setProperty("--inspector-width", clampedWidth + "px");
        splitter.setAttribute("aria-valuenow", Math.round(clampedWidth));
    }

    splitter.addEventListener("pointerdown", function (event) {
        var layout = document.querySelector(".main-layout");
        var inspector = document.querySelector(".request-inspector");
        if (!layout || !inspector) {
            return;
        }
        event.preventDefault();
        var startX = event.clientX;
        var startWidth = inspector.getBoundingClientRect().width;
        layout.classList.add("resizing");

        function handleMove(moveEvent) {
            updateWidth(layout, startWidth + startX - moveEvent.clientX);
        }

        function handleUp() {
            layout.classList.remove("resizing");
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        }

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    });

    splitter.addEventListener("keydown", function (event) {
        if (event.key != "ArrowLeft" && event.key != "ArrowRight") {
            return;
        }
        var layout = document.querySelector(".main-layout");
        var inspector = document.querySelector(".request-inspector");
        if (!layout || !inspector) {
            return;
        }
        event.preventDefault();
        var direction = event.key == "ArrowLeft" ? 20 : -20;
        updateWidth(layout, inspector.getBoundingClientRect().width + direction);
    });

    var horizontalSplitter = document.querySelector(".inspector-horizontal-splitter");
    if (!horizontalSplitter || horizontalSplitter.dataset.bound == "true") {
        return;
    }
    horizontalSplitter.dataset.bound = "true";

    horizontalSplitter.addEventListener("pointerdown", function (event) {
        var panels = document.querySelector(".inspector-panels");
        var requestPanel = document.querySelector(".request-panel");
        var responsePanel = document.querySelector(".response-panel");
        if (!panels || !requestPanel || !responsePanel || requestPanel.classList.contains("collapsed") || responsePanel.classList.contains("collapsed")) {
            return;
        }
        event.preventDefault();
        var startY = event.clientY;
        var startRequestHeight = requestPanel.getBoundingClientRect().height;

        function updatePanelHeights(moveEvent) {
            var availableHeight = panels.getBoundingClientRect().height - horizontalSplitter.getBoundingClientRect().height;
            var nextRequestHeight = Math.max(62, Math.min(startRequestHeight + moveEvent.clientY - startY, Math.max(62, availableHeight - 62)));
            requestPanel.style.flex = "0 0 " + nextRequestHeight + "px";
            responsePanel.style.flex = "1 1 auto";
        }

        function handleMove(moveEvent) {
            updatePanelHeights(moveEvent);
        }

        function handleUp() {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        }

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    });

    horizontalSplitter.addEventListener("keydown", function (event) {
        if (event.key != "ArrowUp" && event.key != "ArrowDown") {
            return;
        }
        var panels = document.querySelector(".inspector-panels");
        var requestPanel = document.querySelector(".request-panel");
        var responsePanel = document.querySelector(".response-panel");
        if (!panels || !requestPanel || !responsePanel || requestPanel.classList.contains("collapsed") || responsePanel.classList.contains("collapsed")) {
            return;
        }
        event.preventDefault();
        var delta = event.key == "ArrowUp" ? -20 : 20;
        var nextRequestHeight = requestPanel.getBoundingClientRect().height + delta;
        var availableHeight = panels.getBoundingClientRect().height - horizontalSplitter.getBoundingClientRect().height;
        requestPanel.style.flex = "0 0 " + Math.max(62, Math.min(nextRequestHeight, Math.max(62, availableHeight - 62))) + "px";
        responsePanel.style.flex = "1 1 auto";
    });
}

function populateFilterOptions(entries) {
    var domains = {};
    var applications = {};
    var hasUnlabeledApplication = false;
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var domain = getRequestDomain(entry.request && entry.request.url);
        if (domain) {
            domains[domain] = true;
        }
        var application = getApplicationInfo(entry);
        if (application.key == "__none__") {
            hasUnlabeledApplication = true;
        } else {
            applications[application.key] = application.label;
        }
    }

    var domainSelect = $(".domain-filter").empty().append($("<option>").attr("value", "").text("全部"));
    Object.keys(domains).sort().forEach(function (domain) {
        domainSelect.append($("<option>").attr("value", domain).text(domain));
    });

    var applicationSelect = $(".application-filter").empty().append($("<option>").attr("value", "").text("全部"));
    Object.keys(applications).sort(function (left, right) {
        return applications[left].localeCompare(applications[right]);
    }).forEach(function (key) {
        applicationSelect.append($("<option>").attr("value", key).text(applications[key]));
    });
    if (hasUnlabeledApplication) {
        applicationSelect.append($("<option>").attr("value", "__none__").text("未标注"));
    }
}

function setupGUI() {
    $(".inspector-panel").each(function () {
        var panel = $(this);
        var tabGroup = panel.find(".tab-group");
        tabGroup.html("");
        panel.find(".page:not([disabled])").each(function () {
            tabGroup.append("<div class='tab' name='" + $(this).attr("name") + "'>" + $(this).attr("name") + "</div>");
        });
        tabGroup.find(".tab").first().addClass("selected");
        panel.find(".page").first().addClass("show");
    });

    $(".tab").off().on("click", function () {
        var panel = $(this).closest(".inspector-panel");
        panel.find(".tab").removeClass("selected");
        $(this).addClass("selected");
        panel.find(".page").removeClass("show");
        panel.find(".page[name='" + $(this).attr("name") + "']").addClass("show");
    });

    $(".inspector-panel-toggle").off().on("click", function () {
        toggleInspectorPanel($(this).closest(".inspector-panel").attr("data-panel"));
    });

    applyInspectorPanelState();
    renderRawViews();

    $(".quick-filter").off().on("click", function () {
        var filter = $(this).attr("data-filter");
        if (filter == "all") {
            $(".quick-filter").removeClass("selected");
            $(this).addClass("selected");
        } else {
            $(".quick-filter[data-filter='all']").removeClass("selected");
            $(this).toggleClass("selected");
            if ($(".quick-filter.selected").length == 0) {
                $(".quick-filter[data-filter='all']").addClass("selected");
            }
        }
        runSearch();
    });

    $(".domain-filter,.application-filter,.search-field,.search-mode").off().on("change", runSearch);
    $(".search").off().on("input", runSearch);
    $(".clear-search").off().on("click", function () {
        $(".search").val("");
        runSearch();
        $(".search").focus();
    });
    $(".inspector-close").off().on("click", closeInspector);

    $(".section-title").off().on("click", function () {
        $(this).parent().toggleClass("hide");
    });

    $(".request-items .request-item").off().on("click", function () {
        selectReq(Number($(this).attr("index")));
    });

    setupInspectorResizer();

    document.addEventListener('keydown', (e) => {
        if (keystrokeTimeout) {
            keystrokeTimeout = false;
            setTimeout(function () {
                handledKeystroke = false;
                keystrokeTimeout = true;
            }, 100);
        }
    });

    runSearch();

    document.addEventListener('keydown', (e) => {
        if ($(e.target).hasClass("search")) {
            runSearch();
        }
        if (e.code === "ArrowUp" && !handledKeystroke) {
            e.preventDefault();
            if (selectedIndex == -1) {
                selectedIndex = reqs.length - 1;
                selectReq(reqs.length - 1);
                handledKeystroke = true;
            } else {
                if (selectedIndex != 0) {
                    selectedIndex--;
                    if (visibleIndicies.includes(selectedIndex)) {
                        selectReq(selectedIndex);
                        handledKeystroke = true;
                    } else {
                        var temp = getNextValue(selectedIndex, false);
                        if (temp != -1) {
                            selectedIndex = temp;
                            selectReq(selectedIndex);
                        } else {
                            selectedIndex++;
                        }
                        handledKeystroke = true;
                    }
                }
            }
        }
        if (e.code === "ArrowDown" && !handledKeystroke) {
            e.preventDefault();
            if (selectedIndex == -1) {
                selectedIndex = 0;
                selectReq(0);
                handledKeystroke = true;
            } else {
                if (selectedIndex < reqs.length - 1) {
                    selectedIndex++;
                    if (visibleIndicies.includes(selectedIndex)) {
                        selectReq(selectedIndex);
                        handledKeystroke = true;
                    } else {
                        var temp = getNextValue(selectedIndex, true);
                        if (temp != -1) {
                            selectedIndex = temp;
                            selectReq(selectedIndex);
                        } else {
                            selectedIndex--;
                        }
                        handledKeystroke = true;
                    }
                }
            }
        }
        var selectedItem = $(".request-item[index='" + selectedIndex + "']").get(0);
        if (selectedItem) {
            selectedItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    });
}

function getNested(path) {
    var args = path.split('.');
    var obj = selectedReq;

    for (var i = 0; i < args.length; i++) {
        if (!obj || !obj.hasOwnProperty(args[i])) {
            return "";
        }
        obj = obj[args[i]];
    }
    return obj;
}

function round(num, place) {
    return +(Math.round(num + "e+" + place) + "e-" + place);
}

function selectReq(index) {
    if (!reqs[index]) {
        return;
    }
    selectedIndex = index;
    selectedReq = reqs[index];
    $(".main-layout").addClass("has-inspector");
    $(".request-inspector").addClass("ready");
    $(".request-item.selected").removeClass("selected");
    $(".request-item[index='" + index + "']").addClass("selected");
    $(".inspector-method-badge").attr("type", selectedReq.method);
    $(".inspector-panel-url").attr("title", selectedReq.fullURL);
    $("*[data]:not([round])").each(function () {
        var value = getNested($(this).attr("data"));
        $(this).text(value == null ? "" : String(value));
    });
    renderRawViews();
    $("*[data][round]").each(function () {
        $(this).text(round(getNested($(this).attr("data")), $(this).attr("round")));
    });
    $(".inspector-timing-bars").attr("totalTime", 0);
    $(".inspector-timing-bars .data-bar").each(function () {
        if ($(this).html() > 0) {
            $(this).parent().attr("totalTime", (+$(this).parent().attr("totalTime")) + (+$(this).html()));
        }
        $(this).attr("time", $(this).html());
        $(this).html("");
    });
    var current = 0;
    $(".inspector-timing-bars .data-bar").each(function () {
        var total = +$(this).parent().attr("totalTime");
        var time = +$(this).attr("time");
        if (time > 0) {
            $(this).attr("style", "width:" + ((time / total) * 100) + "%;margin-left:" + ((current / total) * 100) + "%;");
            current += time;
        } else {
            $(this).attr("style", "");
        }
    });
    $("*[data-table]").html("");
    $("*[data-table]").each(function () {
        var table = getNested($(this).attr("data-table"));
        for (var tableIndex in table) {
            var tableItem = table[tableIndex];
            if (!(tableItem === undefined) && !(tableItem.value === undefined)) {
                $(this).append(`<div class="data-row"><div class="data-key">` + tableItem.name.toString().toHtmlEntities() + `</div><div class="data-value">` + tableItem.value.toString().toHtmlEntities() + `</div></div>`);
            }
        }
    });
    $("*[require-data]").each(function () {
        var table = getNested($(this).attr("require-data"));
        if (table.length == 0) {
            $(this).hide();
        } else {
            $(this).show();
        }
    });

    $("*[require-value]").each(function () {
        var components = $(this).attr("require-value").split("=");
        var value = getNested(components[0]);
        if (new RegExp(components[1]).test(value)) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });

    $("*[data-to]").each(function () {
        if (typeof $(this).attr("require-value") !== 'undefined' && $(this).attr("require-value") !== false) {
            var components = $(this).attr("require-value").split("=");
            var value = getNested(components[0]);
            if (!new RegExp(components[1]).test(value)) {
                return;
            }
        }
        var components = $(this).attr("data-to").split("=");
        var value = getNested(components[1]);
        $(this).attr(components[0], value);
    });

    $(".code-block.shorten").each(function () {
        $(this).scrollTop(0);
        if (selectedReq.formatted) {
            $(this).addClass("formatted");
        } else {
            $(this).removeClass("formatted");
        }
        // if(selectedReq != null && selectedReq.content.length > 10000){
        //     $(this).addClass("collapsable").addClass("collapsed");
        //     $(this).html(selectedReq.contentShort);
        // }else{
        //     $(this).removeClass("collapsable").removeClass("collapsed");
        //     $(this).html(selectedReq.content);
        // }
        $(this).html(selectedReq.contentShort.toString().toHtmlEntities());
    });

    $(".open-new-tab").off().on("dblclick", function () {
        vscode.postMessage({
            action: "openNewTab",
            text: selectedReq.content,
            lang: selectedReq.mimeType.split("\/")[1]
        });
    });

    $(".stack").html("");
    if (selectedReq.obj._initiator?.type == "script") {
        for (var i = 0; i < selectedReq.obj._initiator.stack.callFrames.length; i++) {
            var frame = selectedReq.obj._initiator.stack.callFrames[i];
            const re = new RegExp('(?:.+\/)([^\/?]+)', 'gm');
            var URLMatch = re.exec(frame.url);
            var file = URLMatch == null ? "" : URLMatch[1];
            $(".stack").append(`<tr>
                <td class="stack-frame-function">`+ (frame.functionName.length == 0 ? "(anonymous)" : frame.functionName) + `</td>
                <td class="stack-frame-sID">`+ frame.scriptId + `</td>
                <td class="stack-frame-location">(`+ frame.lineNumber + ":" + frame.columnNumber + `)</td>
                <td class="stack-frame-file"><div>`+ file + `</div></td>
            </tr>`);
        }
    }

    $(".request-inspector").addClass("ready");
}

function toggleBlockCollapse(block) {
    if (block.hasClass("collapsed")) {
        block.removeClass("collapsed");
        $(block).html(getNested($(block).attr("data")).toString().toHtmlEntities());
    } else {
        block.addClass("collapsed");
        $(block).html(getNested($(block).attr("data") + "Short").toString().toHtmlEntities());
    }
}

function formatXML(input, indent) {
    indent = indent || '\t'; //you can set/define other ident than tabs


    //PART 1: Add \n where necessary
    xmlString = input.replace(/^\s+|\s+$/g, '');  //trim it (just in case) {method trim() not working in IE8}

    xmlString = input
        .replace(/(<([a-zA-Z]+\b)[^>]*>)(?!<\/\2>|[\w\s])/g, "$1\n") //add \n after tag if not followed by the closing tag of pair or text node
        .replace(/(<\/[a-zA-Z]+[^>]*>)/g, "$1\n") //add \n after closing tag
        .replace(/>\s+(.+?)\s+<(?!\/)/g, ">\n$1\n<") //add \n between sets of angled brackets and text node between them
        .replace(/>(.+?)<([a-zA-Z])/g, ">\n$1\n<$2") //add \n between angled brackets and text node between them
        .replace(/\?></, "?>\n<") //detect a header of XML

    xmlArr = xmlString.split('\n');  //split it into an array (for analise each line separately)



    //PART 2: indent each line appropriately

    var tabs = '';  //store the current indentation
    var start = 0;  //starting line

    if (/^<[?]xml/.test(xmlArr[0])) start++;  //if the first line is a header, ignore it

    for (var i = start; i < xmlArr.length; i++) //for each line
    {
        var line = xmlArr[i].replace(/^\s+|\s+$/g, '');  //trim it (just in case)

        if (/^<[/]/.test(line))  //if the line is a closing tag
        {
            tabs = tabs.replace(indent, '');  //remove one indent from the store
            xmlArr[i] = tabs + line;  //add the tabs at the beginning of the line
        }
        else if (/<.*>.*<\/.*>|<.*[^>]\/>/.test(line))  //if the line contains an entire node
        {
            //leave the store as is
            xmlArr[i] = tabs + line; //add the tabs at the beginning of the line
        }
        else if (/<.*>/.test(line)) //if the line starts with an opening tag and does not contain an entire node
        {
            xmlArr[i] = tabs + line;  //add the tabs at the beginning of the line
            tabs += indent;  //and add one indent to the store
        }
        else  //if the line contain a text node
        {
            xmlArr[i] = tabs + line;  // add the tabs at the beginning of the line
        }
    }


    //PART 3: return formatted string (source)
    return xmlArr.join('\n');  //rejoin the array to a string and return it
}

function formatJSON(text) {
    try {
        return JSON.stringify(JSON.parse(text), null, 4);
    } catch (e) {
        return text;
    }
}

function format(text, mimeType) {
    if (mimeType == "text/html" || mimeType == "text/xml") {
        return formatXML(text);
    } else if (mimeType == "application/json") {
        return formatJSON(text);
    } else {
        return text;
    }
}

async function loadHARByURL(harURL) {
    try {
        const response = await fetch(harURL);
        if (!response.ok) {
            throw new Error(`Unable to read HAR file (${response.status})`);
        }
        loadHAR(await response.text());
    } catch (error) {
        showLoadError(error);
    }
}

function loadHAR(harText) {
    try {
        har = JSON.parse(harText);
        if (!har.log || !Array.isArray(har.log.entries)) {
            throw new Error("The HAR file does not contain a valid log.entries array.");
        }
    } catch (error) {
        showLoadError(error instanceof SyntaxError ? new Error("The HAR file is not valid JSON.") : error);
        return;
    }
    reqs.length = 0;
    visibleIndicies.length = 0;
    closeInspector();
    $(".request-items").empty();
    populateFilterOptions(har.log.entries);
    for (var i = 0; i < har.log.entries.length; i++) {
        addRequestItem(har.log.entries[i]);
    }
    setupGUI();
    $(".item-loader").addClass("hide");
}

function showLoadError(error) {
    $(".item-loader").addClass("hide");
    $(".request-items").empty().append($("<div>").addClass("load-error").text(error.message));
    console.error(error);
}

function addRequestItem(reqItem) {
    var endpointRegEx = new RegExp("^[^:]*:\/\/([^/]*)([^?]*)");
    var endpointComponents = endpointRegEx.exec(reqItem.request.url);
    var mimeType = reqItem.response.content.mimeType || "text/plain";
    var application = getApplicationInfo(reqItem);
    var domain = endpointComponents ? endpointComponents[1] : getRequestDomain(reqItem.request.url);
    var endpoint = endpointComponents ? endpointComponents[2] : reqItem.request.url;
    var requestHeaders = Array.isArray(reqItem.request.headers) ? reqItem.request.headers : [];
    var referer = "";
    for (var i = 0; i < requestHeaders.length; i++) {
        if (String(requestHeaders[i].name || "").toLowerCase() == "referer") {
            referer = requestHeaders[i].value;
        }
    }
    var content = "";
    var formatted = false;
    if (reqItem.response.content.text != null) {
        content = reqItem.response.content.text;
        if (reqItem.response.content.encoding == "base64") {
            content = atob(reqItem.response.content.text);
        }
        if (mimeType != "text/plain") {
            if (mimeType.includes("image/")) {
                content = "data:" + mimeType.split("/")[1] + ";base64," + reqItem.response.content.text;
            } else {
                formatted = true;
            }
        }
        content = format(content, mimeType);
    }
    var item = {
        "method": reqItem.request.method,
        "time": reqItem.time,
        "fullURL": reqItem.request.url,
        "domain": domain,
        "endpoint": endpoint,
        "application": application.key,
        "applicationLabel": application.label,
        "httpVersion": reqItem.request.httpVersion || "HTTP/1.1",
        "referer": referer,
        "status": reqItem.response.status + " " + reqItem.response.statusText,
        "index": reqs.length,
        "content": content,
        "contentShort": content.substring(0, 5000),
        "mimeType": mimeType,
        "formatted": formatted,
        "protocolGroup": getProtocolGroup(reqItem.request.url),
        "httpVersionGroup": getHttpVersionGroup(reqItem),
        "methodGroup": getMethodGroup(reqItem.request.method),
        "contentGroup": getContentGroup(mimeType),
        "statusGroup": getStatusGroup(reqItem.response.status),
        "requestText": [reqItem.request.method, reqItem.request.url, JSON.stringify(requestHeaders), JSON.stringify(reqItem.request.postData || {})].join(" "),
        "responseText": [reqItem.response.statusText, JSON.stringify(reqItem.response.headers || [])].join(" "),
        "rawRequest": formatRawRequest(reqItem),
        "rawResponse": formatRawResponse(reqItem, content),
        "obj": reqItem
    };
    reqs.push(item);
    addRequestGUIItem(item);
}

function addRequestGUIItem(entity) {
    var newItem = $(".templates .request-item").first().clone();
    newItem.attr("type", entity.obj.request.method);
    newItem.attr("reqType", entity.obj._resourceType);
    newItem.attr("time", entity.obj.time);
    newItem.attr("endpoint", entity.endpoint);
    newItem.attr("fullURL", entity.fullURL);
    newItem.attr("domain", entity.domain);
    newItem.attr("application", entity.application);
    newItem.attr("protocol", entity.protocolGroup);
    newItem.attr("http-version", entity.httpVersionGroup);
    newItem.attr("method-group", entity.methodGroup);
    newItem.attr("content", entity.contentGroup);
    newItem.attr("status-group", entity.statusGroup);
    newItem.attr("status", entity.obj.response.status);
    newItem.attr("index", entity.index);
    if (entity.obj.response.status !== 200) {
        if (entity.obj.response.status >= 400) {
            newItem.attr("highlight", "red");
        } else {
            newItem.attr("highlight", "yellow");
        }
    }
    newItem.attr("index", entity.index);
    newItem.find(".time").text(Math.round(entity.obj.time) + "ms");
    newItem.find(".status").attr("status", entity.obj.response.status);
    newItem.find(".request-id").text(getDisplayRequestId(entity));
    newItem.find(".application").text(entity.applicationLabel).attr("title", entity.applicationLabel);
    if (entity.method.length > 4) {
        switch (entity.method) {
            case "DELETE":
                newItem.find(".method").text("DLTE");
                break;
            case "OPTIONS":
                newItem.find(".method").text("OPNS");
                break;
            default:
                newItem.find(".method").text(entity.method);
                break;
        }
    } else {
        newItem.find(".method").text(entity.method);
    }
    newItem.find(".request-url").text(entity.fullURL).attr("title", entity.fullURL);
    newItem.appendTo(".request-items");
}

window.addEventListener('message', event => {

    const message = event.data; // The JSON data our extension sent

    if (message.command === 'loadError') {
        showLoadError(new Error(message.message));
        return;
    }
});

$(document).ready(function () {
    if (window.harSource) {
        loadHARByURL(window.harSource);
    } else {
        showLoadError(new Error("No HAR file was provided to the analyzer."));
    }
});

String.prototype.toHtmlEntities = function () {
    return this.replace(/./gm, function (s) {
        // return "&#" + s.charCodeAt(0) + ";";
        return (s.match(/[a-z0-9\s]+/i)) ? s : "&#" + s.charCodeAt(0) + ";";
    });
};

String.fromHtmlEntities = function (string) {
    return (string + "").replace(/&#\d+;/gm, function (s) {
        return String.fromCharCode(s.match(/\d+/gm)[0]);
    })
};
