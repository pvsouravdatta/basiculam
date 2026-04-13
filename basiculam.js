// Basiculam - QuickBasic Interpreter

var Basiculam = (function () {

  // DOM references
  var editor = document.getElementById("editor");
  var consoleEl = document.getElementById("console");
  var statusFilename = document.getElementById("status-filename");
  var statusMsg = document.getElementById("status-msg");

  var currentFile = null;

  // --- Modal dialog ---

  var modalOverlay = document.getElementById("modal-overlay");
  var modalTitle = document.getElementById("modal-title");
  var modalBody = document.getElementById("modal-body");
  var modalButtons = document.getElementById("modal-buttons");

  function modalShow(title, bodyHTML, buttons) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML;
    modalButtons.innerHTML = "";
    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.textContent = b.label;
      btn.addEventListener("click", function () {
        modalHide();
        if (b.action) b.action();
      });
      modalButtons.appendChild(btn);
    });
    modalOverlay.classList.add("visible");
  }

  function modalHide() {
    modalOverlay.classList.remove("visible");
  }

  modalOverlay.addEventListener("click", function (e) {
    if (e.target === modalOverlay) modalHide();
  });

  // --- Console ---

  var QB_COLORS = [
    "#000000","#0000AA","#00AA00","#00AAAA",
    "#AA0000","#AA00AA","#AA5500","#AAAAAA",
    "#555555","#5555FF","#55FF55","#55FFFF",
    "#FF5555","#FF55FF","#FFFF55","#FFFFFF"
  ];

  var currentColor = null;

  function consolePrint(text) {
    if (!text) return;
    var node;
    if (currentColor !== null) {
      node = document.createElement("span");
      node.style.color = QB_COLORS[currentColor & 15];
      node.textContent = text;
    } else {
      node = document.createTextNode(text);
    }
    consoleEl.appendChild(node);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function consoleClear() {
    consoleEl.innerHTML = "";
    currentColor = null;
  }

  var consoleInputRow = document.getElementById("console-input-row");
  var consoleInputLabel = document.getElementById("console-input-label");
  var consoleInputEl = document.getElementById("console-input");

  function consoleReadLine(promptStr) {
    return new Promise(function(resolve) {
      consoleInputLabel.textContent = promptStr;
      consoleInputEl.value = "";
      consoleInputRow.classList.add("visible");
      consoleInputEl.focus();
      function finish(val) {
        consoleInputEl.removeEventListener("keydown", onKey);
        consoleInputRow.classList.remove("visible");
        consoleInputEl._cancel = null;
        resolve(val);
      }
      function onKey(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var val = consoleInputEl.value;
          consolePrint(promptStr + val + "\n");
          finish(val);
        }
      }
      consoleInputEl.addEventListener("keydown", onKey);
      consoleInputEl._cancel = function() { finish(""); };
    });
  }

  // --- File operations ---

  var STORAGE_PREFIX = "basiculam_file_";

  function listFiles() {
    var files = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key.indexOf(STORAGE_PREFIX) === 0) {
        files.push(key.substring(STORAGE_PREFIX.length));
      }
    }
    return files.sort();
  }

  function saveFile(name, source) {
    localStorage.setItem(STORAGE_PREFIX + name, source);
  }

  function loadFile(name) {
    return localStorage.getItem(STORAGE_PREFIX + name);
  }

  function doNew() {
    editor.value = "";
    currentFile = null;
    statusFilename.textContent = "Untitled";
    setStatus("New file");
  }

  function doSave() {
    if (currentFile) {
      saveFile(currentFile, editor.value);
      setStatus("Saved: " + currentFile);
    } else {
      doSaveAs();
    }
  }

  function doSaveAs() {
    var defaultName = currentFile || "program.bas";
    modalShow("Save As", '<label>Filename:<input type="text" id="saveas-input" value="' + defaultName + '"></label>', [
      { label: "Save", action: function () {
        var input = document.getElementById("saveas-input");
        var name = input ? input.value.trim() : "";
        if (!name) return;
        saveFile(name, editor.value);
        currentFile = name;
        statusFilename.textContent = name;
        setStatus("Saved: " + name);
      }},
      { label: "Cancel" }
    ]);
    var inp = document.getElementById("saveas-input");
    if (inp) { inp.focus(); inp.select(); }
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        modalButtons.querySelector("button").click();
      }
    });
  }

  function doOpen() {
    var files = listFiles();
    var selectedFile = null;
    var listHTML;

    if (files.length === 0) {
      listHTML = '<div class="file-list-empty">No saved files.</div>';
    } else {
      listHTML = '<div class="file-list" id="open-file-list">';
      for (var i = 0; i < files.length; i++) {
        listHTML += '<div class="file-list-item" data-file="' + files[i] + '">' + files[i] + '</div>';
      }
      listHTML += '</div>';
    }

    modalShow("Open File", listHTML, [
      { label: "Open", action: function () {
        if (!selectedFile) return;
        var source = loadFile(selectedFile);
        if (source !== null) {
          editor.value = source;
          currentFile = selectedFile;
          statusFilename.textContent = selectedFile;
          setStatus("Opened: " + selectedFile);
        }
      }},
      { label: "Cancel" }
    ]);

    var list = document.getElementById("open-file-list");
    if (list) {
      list.addEventListener("click", function (e) {
        var item = e.target.closest(".file-list-item");
        if (!item) return;
        var prev = list.querySelector(".selected");
        if (prev) prev.classList.remove("selected");
        item.classList.add("selected");
        selectedFile = item.getAttribute("data-file");
      });
      list.addEventListener("dblclick", function (e) {
        var item = e.target.closest(".file-list-item");
        if (!item) return;
        selectedFile = item.getAttribute("data-file");
        modalButtons.querySelector("button").click();
      });
    }
  }

  function doClearFiles() {
    var files = listFiles();
    if (files.length === 0) {
      modalShow("Clear Files", "No saved files to clear.", [{ label: "OK" }]);
      return;
    }
    modalShow("Clear All Files",
      "Delete all " + files.length + " saved file(s) from localStorage?<br><br>" +
      "<b>This cannot be undone.</b>",
      [
        { label: "Delete All", action: function () {
          files.forEach(function (f) {
            localStorage.removeItem(STORAGE_PREFIX + f);
          });
          setStatus("Cleared " + files.length + " file(s)");
        }},
        { label: "Cancel" }
      ]
    );
  }

  // --- Lexer ---

  var TT = {
    NUMBER: "NUMBER", STRING: "STRING", IDENT: "IDENT", KEYWORD: "KEYWORD",
    OP: "OP", NEWLINE: "NEWLINE", COLON: "COLON", COMMA: "COMMA",
    SEMI: "SEMI", LPAREN: "LPAREN", RPAREN: "RPAREN", EOF: "EOF"
  };

  var KEYWORDS = new Set([
    "AND","AS","CALL","CASE","CLS","COLOR","CONST","DATA","DECLARE","DIM","DO","ELSE","ELSEIF",
    "END","EXIT","FOR","FUNCTION","GOSUB","GOTO","IF","INPUT","IS","LET","LOCATE","LOOP",
    "MOD","NEXT","NOT","ON","OPTION","OR","PRINT","RANDOMIZE","READ","REM","RESTORE","RETURN",
    "SELECT","SHARED","STEP","STOP","SUB","SWAP","THEN","TO","TYPE","UNTIL","WEND","WHILE","XOR","BASE"
  ]);

  function lex(src) {
    var tokens = [];
    var i = 0;
    var line = 1;

    function tok(type, val) { return { type: type, val: val, line: line }; }

    while (i < src.length) {
      var ch = src[i];

      // newline
      if (ch === "\n") { tokens.push(tok(TT.NEWLINE, "\n")); line++; i++; continue; }
      if (ch === "\r") { i++; continue; }

      // whitespace
      if (ch === " " || ch === "\t") { i++; continue; }

      // REM / line comment
      if (ch === "'") {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }

      // string literal
      if (ch === '"') {
        var s = ""; i++;
        while (i < src.length && src[i] !== '"') {
          if (src[i] === "\n") break;
          s += src[i++];
        }
        if (src[i] === '"') i++;
        tokens.push(tok(TT.STRING, s)); continue;
      }

      // number literal
      if (ch >= "0" && ch <= "9" || (ch === "." && src[i+1] >= "0" && src[i+1] <= "9")) {
        var n = "";
        while (i < src.length && (src[i] >= "0" && src[i] <= "9" || src[i] === ".")) n += src[i++];
        if (src[i] === "E" || src[i] === "e") {
          n += src[i++];
          if (src[i] === "+" || src[i] === "-") n += src[i++];
          while (i < src.length && src[i] >= "0" && src[i] <= "9") n += src[i++];
        }
        // consume type suffix: %, &, !, #
        if (i < src.length && "%&!#".indexOf(src[i]) >= 0) i++;
        tokens.push(tok(TT.NUMBER, parseFloat(n))); continue;
      }

      // identifier or keyword
      if (ch >= "A" && ch <= "Z" || ch >= "a" && ch <= "z" || ch === "_") {
        var id = "";
        while (i < src.length && (src[i] >= "A" && src[i] <= "Z" || src[i] >= "a" && src[i] <= "z" ||
               src[i] >= "0" && src[i] <= "9" || src[i] === "_")) id += src[i++];
        // type suffix for variables: $, %, &, !, #
        if (i < src.length && "$%&!#".indexOf(src[i]) >= 0) id += src[i++];
        var up = id.replace(/[$%&!#]$/, "").toUpperCase();
        // REM keyword starts a comment
        if (up === "REM") { while (i < src.length && src[i] !== "\n") i++; continue; }
        // END SUB / END FUNCTION / END IF / END SELECT as compound keywords
        if (up === "END") {
          var j = i;
          while (j < src.length && (src[j] === " " || src[j] === "\t")) j++;
          var rest = "";
          while (j < src.length && src[j] >= "A" && src[j] <= "Z" || src[j] >= "a" && src[j] <= "z") rest += src[j++];
          var rUp = rest.toUpperCase();
          if (rUp === "SUB" || rUp === "FUNCTION" || rUp === "IF" || rUp === "SELECT" || rUp === "TYPE") {
            tokens.push(tok(TT.KEYWORD, "END " + rUp)); i = j; continue;
          }
        }
        var type = KEYWORDS.has(up) ? TT.KEYWORD : TT.IDENT;
        tokens.push(tok(type, up === id.toUpperCase().replace(/[$%&!#]$/, "") ? id : id));
        continue;
      }

      // operators and punctuation
      if (ch === "<") {
        if (src[i+1] === "=") { tokens.push(tok(TT.OP, "<=")); i += 2; }
        else if (src[i+1] === ">") { tokens.push(tok(TT.OP, "<>")); i += 2; }
        else { tokens.push(tok(TT.OP, "<")); i++; }
        continue;
      }
      if (ch === ">") {
        if (src[i+1] === "=") { tokens.push(tok(TT.OP, ">=")); i += 2; }
        else { tokens.push(tok(TT.OP, ">")); i++; }
        continue;
      }
      if (ch === "=") { tokens.push(tok(TT.OP, "=")); i++; continue; }
      if (ch === "+") { tokens.push(tok(TT.OP, "+")); i++; continue; }
      if (ch === "-") { tokens.push(tok(TT.OP, "-")); i++; continue; }
      if (ch === "*") { tokens.push(tok(TT.OP, "*")); i++; continue; }
      if (ch === "/") { tokens.push(tok(TT.OP, "/")); i++; continue; }
      if (ch === "\\") { tokens.push(tok(TT.OP, "\\")); i++; continue; }
      if (ch === "^") { tokens.push(tok(TT.OP, "^")); i++; continue; }
      if (ch === "(") { tokens.push(tok(TT.LPAREN, "(")); i++; continue; }
      if (ch === ")") { tokens.push(tok(TT.RPAREN, ")")); i++; continue; }
      if (ch === ",") { tokens.push(tok(TT.COMMA, ",")); i++; continue; }
      if (ch === ";") { tokens.push(tok(TT.SEMI, ";")); i++; continue; }
      if (ch === ":") { tokens.push(tok(TT.COLON, ":")); i++; continue; }

      // skip unknown chars
      i++;
    }

    tokens.push(tok(TT.EOF, null));
    return tokens;
  }

  // --- Parser ---

  function parse(tokens) {
    var pos = 0;

    function peek()    { return tokens[pos]; }
    function peekVal() { return tokens[pos].val; }
    function advance() { return tokens[pos++]; }

    function check(type, val) {
      var t = tokens[pos];
      return t.type === type && (val === undefined || t.val === val);
    }

    function eat(type, val) {
      if (!check(type, val)) {
        var t = tokens[pos];
        throw "Expected " + (val !== undefined ? '"' + val + '"' : type) +
              " but got '" + t.val + "' (line " + t.line + ")";
      }
      return advance();
    }

    function skipNewlines() {
      while (check(TT.NEWLINE)) advance();
    }

    // Collect statements until one of stopKws appears as a keyword at line-start
    function parseBlock(stopKws) {
      var stmts = [];
      while (true) {
        skipNewlines();
        if (check(TT.EOF)) break;
        // Lookahead: skip optional line number, then check for stop keyword
        var saved = pos;
        if (check(TT.NUMBER)) advance();
        var atStop = check(TT.KEYWORD) && stopKws.indexOf(peekVal()) >= 0;
        pos = saved;
        if (atStop) break;
        stmts = stmts.concat(parseLine());
      }
      return stmts;
    }

    function parseProgram() {
      var stmts = [];
      skipNewlines();
      while (!check(TT.EOF)) {
        stmts = stmts.concat(parseLine());
        skipNewlines();
      }
      return stmts;
    }

    // One physical line: optional line-number, optional label, colon-separated statements
    function parseLine() {
      var stmts = [];
      if (check(TT.NUMBER)) stmts.push({ type: "LINENUM", num: advance().val });
      // Label: IDENT followed immediately by COLON
      if (check(TT.IDENT) && tokens[pos + 1] && tokens[pos + 1].type === TT.COLON) {
        stmts.push({ type: "LABEL", name: advance().val });
        advance(); // eat COLON
      }
      while (!check(TT.NEWLINE) && !check(TT.EOF)) {
        var s = parseStatement();
        if (s) stmts.push(s);
        if (check(TT.COLON)) advance(); else break;
      }
      if (check(TT.NEWLINE)) advance();
      return stmts;
    }

    // ---- Statements ----

    function parseStatement() {
      var t = peek();
      if (t.type === TT.NEWLINE || t.type === TT.EOF) return null;

      if (t.type === TT.KEYWORD) {
        switch (t.val) {
          case "PRINT":    return parsePrint();
          case "INPUT":    return parseInput();
          case "LET":      advance(); return parseAssign();
          case "IF":       return parseIf();
          case "FOR":      return parseFor();
          case "WHILE":    return parseWhile();
          case "DO":       return parseDo();
          case "GOTO":     advance(); return { type: "GOTO",  target: parseLabel(), line: t.line };
          case "GOSUB":    advance(); return { type: "GOSUB", target: parseLabel(), line: t.line };
          case "RETURN":   advance(); return { type: "RETURN" };
          case "DIM":      return parseDim();
          case "SUB":      return parseSub();
          case "FUNCTION": return parseFunc();
          case "CALL":     advance(); return parseCallStmt();
          case "SELECT":   return parseSelect();
          case "DATA":     return parseData();
          case "READ":     return parseRead();
          case "RESTORE":  return parseRestore();
          case "EXIT":     return parseExit();
          case "END":      advance(); return { type: "END" };
          case "STOP":     advance(); return { type: "STOP" };
          case "CLS":      advance(); return { type: "CLS" };
          case "LOCATE":   return parseLocate();
          case "COLOR":    return parseColor();
          case "SWAP":     return parseSwap();
          case "CONST":    return parseConst();
          case "OPTION":   return parseOption();
          case "ON":       return parseOn();
          case "RANDOMIZE":
            advance();
            return { type: "RANDOMIZE",
                     expr: (!check(TT.NEWLINE) && !check(TT.EOF) && !check(TT.COLON)) ? parseExpr() : null };
          case "DECLARE":
            while (!check(TT.NEWLINE) && !check(TT.EOF)) advance(); // ignore
            return null;
          default:
            throw "Unknown keyword: " + t.val + " (line " + t.line + ")";
        }
      }

      if (t.type === TT.IDENT) return parseAssignOrCall();
      throw "Unexpected token: '" + t.val + "' (line " + t.line + ")";
    }

    function parseLabel() {
      var t = peek();
      if (t.type === TT.NUMBER) { advance(); return t.val; }
      if (t.type === TT.IDENT)  { advance(); return t.val; }
      throw "Expected label (line " + t.line + ")";
    }

    // ---- PRINT ----

    function parsePrint() {
      var ln = peek().line;
      eat(TT.KEYWORD, "PRINT");
      var items = [];
      if (check(TT.NEWLINE) || check(TT.EOF) || check(TT.COLON))
        return { type: "PRINT", items: items, line: ln };
      items.push({ expr: parseExpr(), sep: null });
      while (check(TT.SEMI) || check(TT.COMMA)) {
        items[items.length - 1].sep = advance().val;
        if (!check(TT.NEWLINE) && !check(TT.EOF) && !check(TT.COLON))
          items.push({ expr: parseExpr(), sep: null });
      }
      return { type: "PRINT", items: items, line: ln };
    }

    // ---- INPUT ----

    function parseInput() {
      var ln = peek().line;
      eat(TT.KEYWORD, "INPUT");
      var prompt = null;
      if (check(TT.SEMI)) advance(); // INPUT ; suppresses newline — we ignore
      if (check(TT.STRING)) {
        prompt = advance().val;
        if (check(TT.SEMI) || check(TT.COMMA)) advance();
      }
      var vars = [parseLValue()];
      while (check(TT.COMMA)) { advance(); vars.push(parseLValue()); }
      return { type: "INPUT", prompt: prompt, vars: vars, line: ln };
    }

    function parseLValue() {
      var name = eat(TT.IDENT).val;
      var indices = [];
      if (check(TT.LPAREN)) {
        advance();
        indices.push(parseExpr());
        while (check(TT.COMMA)) { advance(); indices.push(parseExpr()); }
        eat(TT.RPAREN);
      }
      return { name: name, indices: indices };
    }

    // ---- Assignment / implicit CALL ----

    function parseAssign() {
      var lv = parseLValue();
      eat(TT.OP, "=");
      return { type: "LET", name: lv.name, indices: lv.indices, expr: parseExpr() };
    }

    function parseAssignOrCall() {
      var name = advance().val;
      if (check(TT.LPAREN)) {
        advance();
        var args = [];
        if (!check(TT.RPAREN)) {
          args.push(parseExpr());
          while (check(TT.COMMA)) { advance(); args.push(parseExpr()); }
        }
        eat(TT.RPAREN);
        if (check(TT.OP, "=")) { advance(); return { type: "LET", name: name, indices: args, expr: parseExpr() }; }
        return { type: "CALL", name: name, args: args };
      }
      if (check(TT.OP, "=")) {
        advance();
        return { type: "LET", name: name, indices: [], expr: parseExpr() };
      }
      // Implicit sub call: name arg1, arg2
      var args = [];
      if (!check(TT.NEWLINE) && !check(TT.EOF) && !check(TT.COLON)) {
        args.push(parseExpr());
        while (check(TT.COMMA)) { advance(); args.push(parseExpr()); }
      }
      return { type: "CALL", name: name, args: args };
    }

    // ---- IF ----

    function parseIf() {
      var ln = peek().line;
      eat(TT.KEYWORD, "IF");
      var cond = parseExpr();
      eat(TT.KEYWORD, "THEN");

      // Single-line IF: statement(s) on same line
      if (!check(TT.NEWLINE) && !check(TT.EOF)) {
        var thenBody = check(TT.NUMBER)
          ? [{ type: "GOTO", target: advance().val }]
          : parseSingleLineStmts();
        var elseBody = [];
        if (check(TT.KEYWORD) && peekVal() === "ELSE") {
          advance();
          if (check(TT.NUMBER))
            elseBody = [{ type: "GOTO", target: advance().val }];
          else if (!check(TT.NEWLINE) && !check(TT.EOF))
            elseBody = parseSingleLineStmts();
        }
        return { type: "IF", cond: cond, then: thenBody, elseifs: [], else: elseBody, line: ln };
      }

      // Block IF
      if (check(TT.NEWLINE)) advance();
      var thenBody = parseBlock(["ELSE", "ELSEIF", "END IF"]);
      var elseifs = [];
      var elseBody = [];

      while (check(TT.KEYWORD) && peekVal() === "ELSEIF") {
        advance();
        var eiCond = parseExpr();
        eat(TT.KEYWORD, "THEN");
        if (check(TT.NEWLINE)) advance();
        elseifs.push({ cond: eiCond, body: parseBlock(["ELSE", "ELSEIF", "END IF"]) });
      }
      if (check(TT.KEYWORD) && peekVal() === "ELSE") {
        advance();
        if (check(TT.NEWLINE)) advance();
        elseBody = parseBlock(["END IF"]);
      }
      eat(TT.KEYWORD, "END IF");
      return { type: "IF", cond: cond, then: thenBody, elseifs: elseifs, else: elseBody, line: ln };
    }

    function parseSingleLineStmts() {
      var stmts = [parseStatement()];
      while (check(TT.COLON)) {
        advance();
        if (check(TT.NEWLINE) || check(TT.EOF)) break;
        if (check(TT.KEYWORD) && peekVal() === "ELSE") break;
        stmts.push(parseStatement());
      }
      return stmts;
    }

    // ---- FOR / NEXT ----

    function parseFor() {
      var ln = peek().line;
      eat(TT.KEYWORD, "FOR");
      var varName = eat(TT.IDENT).val;
      eat(TT.OP, "=");
      var from = parseExpr();
      eat(TT.KEYWORD, "TO");
      var to = parseExpr();
      var step = null;
      if (check(TT.KEYWORD) && peekVal() === "STEP") { advance(); step = parseExpr(); }
      var body;
      if (check(TT.NEWLINE)) {
        advance();
        body = parseBlock(["NEXT"]);
      } else {
        // single-line: FOR ... : stmt : ... : NEXT [var]
        body = [];
        while (!check(TT.NEWLINE) && !check(TT.EOF)) {
          if (check(TT.COLON)) { advance(); continue; }
          if (check(TT.KEYWORD) && peekVal() === "NEXT") break;
          var s = parseStatement();
          if (s) body.push(s);
        }
      }
      eat(TT.KEYWORD, "NEXT");
      if (check(TT.IDENT)) advance();
      return { type: "FOR", var: varName, from: from, to: to, step: step, body: body, line: ln };
    }

    // ---- WHILE / WEND ----

    function parseWhile() {
      var ln = peek().line;
      eat(TT.KEYWORD, "WHILE");
      var cond = parseExpr();
      if (check(TT.NEWLINE)) advance();
      var body = parseBlock(["WEND"]);
      eat(TT.KEYWORD, "WEND");
      return { type: "WHILE", cond: cond, body: body, line: ln };
    }

    // ---- DO / LOOP ----

    function parseDo() {
      var ln = peek().line;
      eat(TT.KEYWORD, "DO");
      var preKind = null, preCond = null;
      if (check(TT.KEYWORD) && (peekVal() === "WHILE" || peekVal() === "UNTIL")) {
        preKind = advance().val; preCond = parseExpr();
      }
      if (check(TT.NEWLINE)) advance();
      var body = parseBlock(["LOOP"]);
      eat(TT.KEYWORD, "LOOP");
      var postKind = null, postCond = null;
      if (check(TT.KEYWORD) && (peekVal() === "WHILE" || peekVal() === "UNTIL")) {
        postKind = advance().val; postCond = parseExpr();
      }
      return { type: "DO", preKind: preKind, preCond: preCond, body: body,
               postKind: postKind, postCond: postCond, line: ln };
    }

    // ---- DIM ----

    function parseDim() {
      eat(TT.KEYWORD, "DIM");
      var shared = false;
      if (check(TT.KEYWORD) && peekVal() === "SHARED") { advance(); shared = true; }
      var vars = [parseDimVar()];
      while (check(TT.COMMA)) { advance(); vars.push(parseDimVar()); }
      return { type: "DIM", shared: shared, vars: vars };
    }

    function parseDimVar() {
      var name = eat(TT.IDENT).val;
      var dims = [];
      if (check(TT.LPAREN)) {
        advance();
        dims.push(parseDimBound());
        while (check(TT.COMMA)) { advance(); dims.push(parseDimBound()); }
        eat(TT.RPAREN);
      }
      var asType = null;
      if (check(TT.KEYWORD) && peekVal() === "AS") { advance(); asType = advance().val; }
      return { name: name, dims: dims, asType: asType };
    }

    function parseDimBound() {
      var lo = parseExpr();
      if (check(TT.KEYWORD) && peekVal() === "TO") { advance(); return { lo: lo, hi: parseExpr() }; }
      return { lo: null, hi: lo };
    }

    // ---- SUB / FUNCTION ----

    function parseSub() {
      eat(TT.KEYWORD, "SUB");
      var name = eat(TT.IDENT).val;
      var params = parseParams();
      if (check(TT.NEWLINE)) advance();
      var body = parseBlock(["END SUB"]);
      eat(TT.KEYWORD, "END SUB");
      return { type: "SUB", name: name, params: params, body: body };
    }

    function parseFunc() {
      eat(TT.KEYWORD, "FUNCTION");
      var name = eat(TT.IDENT).val;
      var params = parseParams();
      if (check(TT.NEWLINE)) advance();
      var body = parseBlock(["END FUNCTION"]);
      eat(TT.KEYWORD, "END FUNCTION");
      return { type: "FUNCTION", name: name, params: params, body: body };
    }

    function parseParams() {
      var params = [];
      if (!check(TT.LPAREN)) return params;
      advance();
      if (!check(TT.RPAREN)) {
        params.push(parseParamDecl());
        while (check(TT.COMMA)) { advance(); params.push(parseParamDecl()); }
      }
      eat(TT.RPAREN);
      return params;
    }

    function parseParamDecl() {
      var name = eat(TT.IDENT).val;
      if (check(TT.LPAREN) && tokens[pos + 1] && tokens[pos + 1].type === TT.RPAREN) {
        advance(); advance(); name += "()"; // array param
      }
      var asType = null;
      if (check(TT.KEYWORD) && peekVal() === "AS") { advance(); asType = advance().val; }
      return { name: name, asType: asType };
    }

    // ---- CALL (explicit) ----

    function parseCallStmt() {
      var name = eat(TT.IDENT).val;
      var args = [];
      if (check(TT.LPAREN)) {
        advance();
        if (!check(TT.RPAREN)) {
          args.push(parseExpr());
          while (check(TT.COMMA)) { advance(); args.push(parseExpr()); }
        }
        eat(TT.RPAREN);
      }
      return { type: "CALL", name: name, args: args };
    }

    // ---- SELECT CASE ----

    function parseSelect() {
      eat(TT.KEYWORD, "SELECT");
      eat(TT.KEYWORD, "CASE");
      var expr = parseExpr();
      if (check(TT.NEWLINE)) advance();
      var cases = [], defBody = null;
      while (true) {
        skipNewlines();
        if (check(TT.EOF) || (check(TT.KEYWORD) && peekVal() === "END SELECT")) break;
        if (!check(TT.KEYWORD) || peekVal() !== "CASE") break;
        advance();
        if (check(TT.KEYWORD) && peekVal() === "ELSE") {
          advance();
          if (check(TT.NEWLINE)) advance();
          defBody = parseBlock(["CASE", "END SELECT"]);
        } else {
          var exprs = parseCaseExprs();
          if (check(TT.NEWLINE)) advance();
          cases.push({ exprs: exprs, body: parseBlock(["CASE", "END SELECT"]) });
        }
      }
      eat(TT.KEYWORD, "END SELECT");
      return { type: "SELECT", expr: expr, cases: cases, default: defBody };
    }

    function parseCaseExprs() {
      var list = [parseCaseExpr()];
      while (check(TT.COMMA)) { advance(); list.push(parseCaseExpr()); }
      return list;
    }

    function parseCaseExpr() {
      if (check(TT.KEYWORD) && peekVal() === "IS") {
        advance(); return { kind: "IS", op: advance().val, expr: parseExpr() };
      }
      var e = parseExpr();
      if (check(TT.KEYWORD) && peekVal() === "TO") { advance(); return { kind: "RANGE", lo: e, hi: parseExpr() }; }
      return { kind: "EXPR", expr: e };
    }

    // ---- DATA / READ / RESTORE ----

    function parseData() {
      eat(TT.KEYWORD, "DATA");
      var vals = [parseDataVal()];
      while (check(TT.COMMA)) { advance(); vals.push(parseDataVal()); }
      return { type: "DATA", values: vals };
    }

    function parseDataVal() {
      if (check(TT.STRING)) return { type: "STR", val: advance().val };
      var neg = false;
      if (check(TT.OP, "-")) { advance(); neg = true; }
      if (check(TT.NUMBER)) { var n = advance().val; return { type: "NUM", val: neg ? -n : n }; }
      var s = "";
      while (!check(TT.COMMA) && !check(TT.NEWLINE) && !check(TT.EOF) && !check(TT.COLON))
        s += advance().val;
      return { type: "STR", val: s.trim() };
    }

    function parseRead() {
      eat(TT.KEYWORD, "READ");
      var vars = [parseLValue()];
      while (check(TT.COMMA)) { advance(); vars.push(parseLValue()); }
      return { type: "READ", vars: vars };
    }

    function parseRestore() {
      eat(TT.KEYWORD, "RESTORE");
      var target = null;
      if (!check(TT.NEWLINE) && !check(TT.EOF) && !check(TT.COLON)) target = parseLabel();
      return { type: "RESTORE", target: target };
    }

    // ---- EXIT ----

    function parseExit() {
      eat(TT.KEYWORD, "EXIT");
      return { type: "EXIT", what: advance().val };
    }

    // ---- Misc statements ----

    function parseLocate() {
      eat(TT.KEYWORD, "LOCATE");
      var row = null, col = null;
      if (!check(TT.COMMA) && !check(TT.NEWLINE) && !check(TT.EOF)) row = parseExpr();
      if (check(TT.COMMA)) { advance(); if (!check(TT.NEWLINE) && !check(TT.EOF)) col = parseExpr(); }
      return { type: "LOCATE", row: row, col: col };
    }

    function parseColor() {
      eat(TT.KEYWORD, "COLOR");
      var fg = parseExpr(), bg = null;
      if (check(TT.COMMA)) { advance(); bg = parseExpr(); }
      return { type: "COLOR", fg: fg, bg: bg };
    }

    function parseSwap() {
      eat(TT.KEYWORD, "SWAP");
      var a = parseLValue(); eat(TT.COMMA); var b = parseLValue();
      return { type: "SWAP", a: a, b: b };
    }

    function parseConst() {
      eat(TT.KEYWORD, "CONST");
      var name = eat(TT.IDENT).val;
      eat(TT.OP, "=");
      return { type: "CONST", name: name, expr: parseExpr() };
    }

    function parseOption() {
      eat(TT.KEYWORD, "OPTION");
      eat(TT.KEYWORD, "BASE");
      return { type: "OPTION_BASE", val: eat(TT.NUMBER).val };
    }

    function parseOn() {
      eat(TT.KEYWORD, "ON");
      var expr = parseExpr();
      var kw = advance().val; // GOTO or GOSUB
      var targets = [parseLabel()];
      while (check(TT.COMMA)) { advance(); targets.push(parseLabel()); }
      return { type: "ON", expr: expr, kw: kw, targets: targets };
    }

    // ---- Expressions (recursive descent, low to high precedence) ----

    function parseExpr() { return parseOr(); }

    function parseOr() {
      var left = parseAnd();
      while (check(TT.KEYWORD) && (peekVal() === "OR" || peekVal() === "XOR")) {
        var op = advance().val;
        left = { type: "BINOP", op: op, left: left, right: parseAnd() };
      }
      return left;
    }

    function parseAnd() {
      var left = parseNot();
      while (check(TT.KEYWORD) && peekVal() === "AND") {
        advance();
        left = { type: "BINOP", op: "AND", left: left, right: parseNot() };
      }
      return left;
    }

    function parseNot() {
      if (check(TT.KEYWORD) && peekVal() === "NOT") { advance(); return { type: "UNOP", op: "NOT", expr: parseNot() }; }
      return parseCompare();
    }

    function parseCompare() {
      var left = parseAdd();
      while (check(TT.OP) && ["=", "<>", "<", ">", "<=", ">="].indexOf(peekVal()) >= 0) {
        var op = advance().val;
        left = { type: "BINOP", op: op, left: left, right: parseAdd() };
      }
      return left;
    }

    function parseAdd() {
      var left = parseMul();
      while (check(TT.OP) && (peekVal() === "+" || peekVal() === "-")) {
        var op = advance().val;
        left = { type: "BINOP", op: op, left: left, right: parseMul() };
      }
      return left;
    }

    function parseMul() {
      var left = parsePow();
      while ((check(TT.OP) && ["*", "/", "\\"].indexOf(peekVal()) >= 0) ||
             (check(TT.KEYWORD) && peekVal() === "MOD")) {
        var op = advance().val;
        left = { type: "BINOP", op: op, left: left, right: parsePow() };
      }
      return left;
    }

    function parsePow() {
      var left = parseUnary();
      if (check(TT.OP) && peekVal() === "^") {
        advance(); return { type: "BINOP", op: "^", left: left, right: parsePow() };
      }
      return left;
    }

    function parseUnary() {
      if (check(TT.OP) && peekVal() === "-") { advance(); return { type: "UNOP", op: "-", expr: parsePrimary() }; }
      if (check(TT.OP) && peekVal() === "+") { advance(); return parsePrimary(); }
      return parsePrimary();
    }

    function parsePrimary() {
      var t = peek();
      if (t.type === TT.NUMBER) { advance(); return { type: "NUM", val: t.val }; }
      if (t.type === TT.STRING) { advance(); return { type: "STR", val: t.val }; }
      if (t.type === TT.LPAREN) {
        advance(); var e = parseExpr(); eat(TT.RPAREN); return e;
      }
      if (t.type === TT.IDENT || t.type === TT.KEYWORD) {
        var name = advance().val;
        if (check(TT.LPAREN)) {
          advance();
          var args = [];
          if (!check(TT.RPAREN)) {
            args.push(parseExpr());
            while (check(TT.COMMA)) { advance(); args.push(parseExpr()); }
          }
          eat(TT.RPAREN);
          return { type: "CALL", name: name, args: args };
        }
        return { type: "VAR", name: name };
      }
      throw "Unexpected token in expression: '" + t.val + "' (line " + t.line + ")";
    }

    try {
      return { ok: true, stmts: parseProgram() };
    } catch (e) {
      return { ok: false, error: typeof e === "string" ? e : (e.message || String(e)) };
    }
  }

  // --- Interpreter ---

  var printCol = 0;
  var stopRequested = false;
  var running = false;
  var yieldCounter = 0;

  function fnKey(name) { return name.replace(/[$%&!#]$/, "").toUpperCase(); }

  function getVar(env, name) {
    var k = name.toUpperCase();
    return k in env.vars ? env.vars[k] : (name.slice(-1) === "$" ? "" : 0);
  }
  function setVar(env, name, val) { env.vars[name.toUpperCase()] = val; }

  function flatIdx(arr, indices) {
    var idx = 0, stride = 1;
    for (var i = arr.dims.length - 1; i >= 0; i--) {
      idx += (indices[i] - arr.dims[i].lo) * stride;
      stride *= (arr.dims[i].hi - arr.dims[i].lo + 1);
    }
    return idx;
  }
  function autoArr(env, name) {
    var sz = 11 - env.base;
    return { dims: [{ lo: env.base, hi: 10 }], data: new Array(sz).fill(name.slice(-1) === "$" ? "" : 0) };
  }
  function getArr(env, name, indices) {
    var k = name.toUpperCase();
    if (!(k in env.arrays)) env.arrays[k] = autoArr(env, name);
    var arr = env.arrays[k], idx = flatIdx(arr, indices);
    if (idx < 0 || idx >= arr.data.length) throw new Error("Subscript out of range: " + name + "(" + indices + ")");
    return arr.data[idx];
  }
  function setArr(env, name, indices, val) {
    var k = name.toUpperCase();
    if (!(k in env.arrays)) env.arrays[k] = autoArr(env, name);
    var arr = env.arrays[k], idx = flatIdx(arr, indices);
    if (idx < 0 || idx >= arr.data.length) throw new Error("Subscript out of range: " + name + "(" + indices + ")");
    arr.data[idx] = val;
  }

  // ---- Built-in functions ----

  var BUILTINS = {
    "ABS":     function(a) { return Math.abs(a[0]); },
    "INT":     function(a) { return Math.floor(a[0]); },
    "FIX":     function(a) { return Math.trunc(a[0]); },
    "SGN":     function(a) { return a[0] > 0 ? 1 : a[0] < 0 ? -1 : 0; },
    "SQR":     function(a) { return Math.sqrt(a[0]); },
    "SIN":     function(a) { return Math.sin(a[0]); },
    "COS":     function(a) { return Math.cos(a[0]); },
    "TAN":     function(a) { return Math.tan(a[0]); },
    "ATN":     function(a) { return Math.atan(a[0]); },
    "LOG":     function(a) { return Math.log(a[0]); },
    "EXP":     function(a) { return Math.exp(a[0]); },
    "RND":     function(a) { return Math.random(); },
    "CINT":    function(a) { return Math.round(a[0]); },
    "CLNG":    function(a) { return Math.round(a[0]); },
    "CSNG":    function(a) { return a[0]; },
    "CDBL":    function(a) { return a[0]; },
    "LEN":     function(a) { return String(a[0]).length; },
    "LEFT$":   function(a) { return String(a[0]).substring(0, a[1]); },
    "RIGHT$":  function(a) { var s = String(a[0]); return s.substring(s.length - a[1]); },
    "MID$":    function(a) { var s = String(a[0]), st = a[1] - 1; return a[2] !== undefined ? s.substr(st, a[2]) : s.substring(st); },
    "CHR$":    function(a) { return String.fromCharCode(a[0]); },
    "ASC":     function(a) { return (String(a[0]).charCodeAt(0)) || 0; },
    "UCASE$":  function(a) { return String(a[0]).toUpperCase(); },
    "LCASE$":  function(a) { return String(a[0]).toLowerCase(); },
    "LTRIM$":  function(a) { return String(a[0]).trimStart(); },
    "RTRIM$":  function(a) { return String(a[0]).trimEnd(); },
    "STR$":    function(a) { return a[0] >= 0 ? " " + a[0] : String(a[0]); },
    "VAL":     function(a) { return parseFloat(String(a[0])) || 0; },
    "SPACE$":  function(a) { return " ".repeat(Math.max(0, a[0])); },
    "STRING$": function(a) { var c = typeof a[1] === "number" ? String.fromCharCode(a[1]) : String(a[1])[0] || ""; return c.repeat(Math.max(0, a[0])); },
    "INSTR":   function(a) {
      if (a.length >= 3) { var i = String(a[1]).indexOf(String(a[2]), a[0] - 1); return i < 0 ? 0 : i + 1; }
      var i = String(a[0]).indexOf(String(a[1])); return i < 0 ? 0 : i + 1;
    },
    "HEX$":    function(a) { return (a[0] >>> 0).toString(16).toUpperCase(); },
    "OCT$":    function(a) { return (a[0] >>> 0).toString(8); },
    "TAB":     function(a) { return { __tab: a[0] }; },
    "SPC":     function(a) { return " ".repeat(Math.max(0, a[0])); },
    "TIMER":   function()  { return (Date.now() / 1000) % 86400; },
    "DATE$":   function()  { return new Date().toLocaleDateString("en-US"); },
    "TIME$":   function()  { return new Date().toLocaleTimeString(); },
  };

  // ---- Yield / stop ----

  async function checkYield() {
    if (stopRequested) throw { qbSignal: "STOP" };
    if (++yieldCounter % 500 === 0) {
      await new Promise(function(r) { setTimeout(r, 0); });
      if (stopRequested) throw { qbSignal: "STOP" };
    }
  }

  // ---- Expression evaluator ----

  async function evalExpr(node, env) {
    switch (node.type) {
      case "NUM":  return node.val;
      case "STR":  return node.val;
      case "VAR":  return getVar(env, node.name);
      case "CALL": return await evalFnCall(node.name, node.args, env);
      case "BINOP": return await evalBinop(node.op, node.left, node.right, env);
      case "UNOP":  return await evalUnop(node.op, node.expr, env);
      default: throw new Error("Unknown expr node: " + node.type);
    }
  }

  async function evalBinop(op, ln, rn, env) {
    var L = await evalExpr(ln, env), R = await evalExpr(rn, env);
    switch (op) {
      case "+":   return (typeof L === "string" || typeof R === "string") ? String(L) + String(R) : L + R;
      case "-":   return L - R;
      case "*":   return L * R;
      case "/":   return R ? L / R : 0;
      case "\\":  return Math.trunc(L / R) | 0;
      case "^":   return Math.pow(L, R);
      case "MOD": return L - Math.trunc(L / R) * R;
      case "=":   return (typeof L === "string" ? L === R : L == R) ? -1 : 0;
      case "<>":  return (typeof L === "string" ? L !== R : L != R) ? -1 : 0;
      case "<":   return L < R ? -1 : 0;
      case ">":   return L > R ? -1 : 0;
      case "<=":  return L <= R ? -1 : 0;
      case ">=":  return L >= R ? -1 : 0;
      case "AND": return (Math.trunc(L) & Math.trunc(R)) | 0;
      case "OR":  return (Math.trunc(L) | Math.trunc(R)) | 0;
      case "XOR": return (Math.trunc(L) ^ Math.trunc(R)) | 0;
      default: throw new Error("Unknown operator: " + op);
    }
  }

  async function evalUnop(op, en, env) {
    var v = await evalExpr(en, env);
    if (op === "-")   return -v;
    if (op === "NOT") return (~Math.trunc(v)) | 0;
    throw new Error("Unknown unary op: " + op);
  }

  async function evalFnCall(name, argNodes, env) {
    var key = fnKey(name), keyFull = name.toUpperCase();

    if (key === "LBOUND" || key === "UBOUND") {
      var arrName = argNodes[0].name || String(argNodes[0].val);
      var dimIdx = argNodes[1] ? (await evalExpr(argNodes[1], env)) - 1 : 0;
      var k = arrName.toUpperCase();
      var arr = env.arrays[k] || autoArr(env, arrName);
      return key === "LBOUND" ? arr.dims[dimIdx].lo : arr.dims[dimIdx].hi;
    }

    var args = [];
    for (var i = 0; i < argNodes.length; i++) args.push(await evalExpr(argNodes[i], env));
    if (key in BUILTINS)     return BUILTINS[key](args, env);
    if (keyFull in BUILTINS) return BUILTINS[keyFull](args, env);
    if (key in env.funcs)    return await callUserFunc(env.funcs[key], args, env);
    return getArr(env, name, args);
  }

  // ---- PRINT ----

  function formatVal(val) {
    if (typeof val === "string") return val;
    var n = val, s;
    s = (n === Math.floor(n) && Math.abs(n) < 1e15) ? String(Math.trunc(n)) : parseFloat(n.toPrecision(7)).toString();
    return (n >= 0 ? " " : "") + s + " ";
  }

  async function execPrint(s, env) {
    for (var i = 0; i < s.items.length; i++) {
      var item = s.items[i];
      var val = await evalExpr(item.expr, env);
      var str;
      if (val && typeof val === "object" && "__tab" in val) {
        str = " ".repeat(Math.max(0, val.__tab - 1 - printCol));
      } else {
        str = formatVal(val);
      }
      consolePrint(str);
      printCol += str.length;
      if (item.sep === ",") {
        var pad = (Math.floor(printCol / 14) + 1) * 14 - printCol;
        consolePrint(" ".repeat(pad));
        printCol += pad;
      }
    }
    var lastSep = s.items.length ? s.items[s.items.length - 1].sep : null;
    if (lastSep !== ";" && lastSep !== ",") { consolePrint("\n"); printCol = 0; }
  }

  // ---- Statement execution ----

  async function execRunnable(stmts, env) {
    var labels = Object.create(null);
    for (var i = 0; i < stmts.length; i++) {
      var s = stmts[i];
      if (!s) continue;
      if (s.type === "LABEL")   labels[s.name.toUpperCase()] = i;
      if (s.type === "LINENUM") labels[String(s.num)] = i;
    }
    var pc = 0, gosubStack = [];
    while (pc < stmts.length) {
      var s = stmts[pc]; pc++;
      if (!s || s.type === "LABEL" || s.type === "LINENUM" ||
          s.type === "SUB" || s.type === "FUNCTION" || s.type === "DATA") continue;
      await checkYield();
      try {
        await execStmt(s, env);
      } catch (sig) {
        if (!sig || !sig.qbSignal) throw sig;
        if (sig.qbSignal === "GOTO") {
          var t = String(sig.target).toUpperCase();
          if (!(t in labels)) throw new Error("Undefined label: " + sig.target);
          pc = labels[t]; continue;
        }
        if (sig.qbSignal === "GOSUB") {
          var t = String(sig.target).toUpperCase();
          if (!(t in labels)) throw new Error("Undefined label: " + sig.target);
          gosubStack.push(pc); pc = labels[t]; continue;
        }
        if (sig.qbSignal === "RETURN") {
          if (!gosubStack.length) throw new Error("RETURN without GOSUB");
          pc = gosubStack.pop(); continue;
        }
        if (sig.qbSignal === "END" || sig.qbSignal === "STOP") return;
        throw sig;
      }
    }
  }

  async function execBlock(stmts, env) {
    for (var i = 0; i < stmts.length; i++) {
      var s = stmts[i];
      if (!s || s.type === "LABEL" || s.type === "LINENUM" || s.type === "DATA") continue;
      await execStmt(s, env);
    }
  }

  async function execStmt(s, env) {
    switch (s.type) {
      case "PRINT":    await execPrint(s, env); break;
      case "INPUT":    await execInput(s, env); break;
      case "LET":      await execLet(s, env); break;
      case "IF":       await execIf(s, env); break;
      case "FOR":      await execFor(s, env); break;
      case "WHILE":    await execWhile(s, env); break;
      case "DO":       await execDo(s, env); break;
      case "DIM":      await execDim(s, env); break;
      case "CALL":     await execCallStmt(s, env); break;
      case "SELECT":   await execSelect(s, env); break;
      case "READ":     await execRead(s, env); break;
      case "RESTORE":  execRestore(s, env); break;
      case "SWAP":     await execSwap(s, env); break;
      case "ON":       await execOn(s, env); break;
      case "CONST":    setVar(env, s.name, await evalExpr(s.expr, env)); break;
      case "OPTION_BASE": env.base = s.val; break;
      case "RANDOMIZE": if (s.expr) await evalExpr(s.expr, env); break;
      case "CLS":      consoleClear(); printCol = 0; break;
      case "LOCATE":   break;
      case "COLOR":    currentColor = Math.round(await evalExpr(s.fg, env)) & 15; break;
      case "GOTO":     throw { qbSignal: "GOTO",  target: s.target };
      case "GOSUB":    throw { qbSignal: "GOSUB", target: s.target };
      case "RETURN":   throw { qbSignal: "RETURN" };
      case "EXIT":     execExit(s); break;
      case "END":      throw { qbSignal: "END" };
      case "STOP":     throw { qbSignal: "STOP" };
      case "SUB":      break;
      case "FUNCTION": break;
      default: throw new Error("Unknown statement: " + s.type);
    }
  }

  async function execLet(s, env) {
    if (fnKey(s.name) === "MID$" && s.indices.length >= 2) {
      var strName = s.indices[0].name;
      var start = (await evalExpr(s.indices[1], env)) - 1;
      var lenArg = s.indices[2] !== undefined ? await evalExpr(s.indices[2], env) : null;
      var repl = String(await evalExpr(s.expr, env));
      var str = String(getVar(env, strName));
      var len = lenArg !== null ? lenArg : repl.length;
      setVar(env, strName, str.substring(0, start) + repl.substring(0, len) + str.substring(start + len));
      return;
    }
    var val = await evalExpr(s.expr, env);
    if (s.indices.length) {
      var idxs = [];
      for (var i = 0; i < s.indices.length; i++) idxs.push(await evalExpr(s.indices[i], env));
      setArr(env, s.name, idxs, val);
    } else {
      setVar(env, s.name, val);
    }
  }

  async function execInput(s, env) {
    for (var i = 0; i < s.vars.length; i++) {
      var lv = s.vars[i];
      var promptStr = i === 0 && s.prompt !== null ? s.prompt + "? " : "? ";
      var raw = await consoleReadLine(promptStr);
      printCol = 0;
      var val = lv.name.slice(-1) === "$" ? raw : (parseFloat(raw) || 0);
      if (lv.indices.length) {
        var idxs = [];
        for (var j = 0; j < lv.indices.length; j++) idxs.push(await evalExpr(lv.indices[j], env));
        setArr(env, lv.name, idxs, val);
      } else {
        setVar(env, lv.name, val);
      }
    }
  }

  async function execIf(s, env) {
    if (await evalExpr(s.cond, env) !== 0) { await execBlock(s.then, env); return; }
    for (var i = 0; i < s.elseifs.length; i++) {
      if (await evalExpr(s.elseifs[i].cond, env) !== 0) { await execBlock(s.elseifs[i].body, env); return; }
    }
    if (s.else.length) await execBlock(s.else, env);
  }

  async function execFor(s, env) {
    var from = await evalExpr(s.from, env), to = await evalExpr(s.to, env);
    var step = s.step ? await evalExpr(s.step, env) : 1;
    setVar(env, s.var, from);
    while (true) {
      var v = getVar(env, s.var);
      if (step > 0 && v > to) break;
      if (step < 0 && v < to) break;
      if (step === 0) break;
      try { await execBlock(s.body, env); }
      catch (sig) { if (sig && sig.qbSignal === "EXIT" && sig.what === "FOR") break; throw sig; }
      setVar(env, s.var, getVar(env, s.var) + step);
    }
  }

  async function execWhile(s, env) {
    while (await evalExpr(s.cond, env) !== 0) {
      try { await execBlock(s.body, env); }
      catch (sig) { if (sig && sig.qbSignal === "EXIT" && sig.what === "DO") break; throw sig; }
    }
  }

  async function execDo(s, env) {
    async function body() {
      try { await execBlock(s.body, env); return true; }
      catch (sig) { if (sig && sig.qbSignal === "EXIT" && sig.what === "DO") return false; throw sig; }
    }
    if (s.preKind === "WHILE") {
      while (await evalExpr(s.preCond, env) !== 0) if (!await body()) break;
    } else if (s.preKind === "UNTIL") {
      while (await evalExpr(s.preCond, env) === 0) if (!await body()) break;
    } else {
      do {
        if (!await body()) break;
        if (s.postKind === "UNTIL" && await evalExpr(s.postCond, env) !== 0) break;
        if (s.postKind === "WHILE" && await evalExpr(s.postCond, env) === 0) break;
      } while (true);
    }
  }

  async function execDim(s, env) {
    for (var vi = 0; vi < s.vars.length; vi++) {
      var v = s.vars[vi];
      var k = v.name.toUpperCase();
      if (v.dims.length) {
        var dims = [];
        for (var di = 0; di < v.dims.length; di++) {
          var d = v.dims[di];
          dims.push({ lo: d.lo !== null ? Math.round(await evalExpr(d.lo, env)) : env.base,
                      hi: Math.round(await evalExpr(d.hi, env)) });
        }
        var sz = dims.reduce(function(acc, d) { return acc * (d.hi - d.lo + 1); }, 1);
        env.arrays[k] = { dims: dims, data: new Array(sz).fill(v.name.slice(-1) === "$" ? "" : 0) };
      }
    }
  }

  async function execCallStmt(s, env) {
    var key = fnKey(s.name);
    var args = [];
    for (var i = 0; i < s.args.length; i++) args.push(await evalExpr(s.args[i], env));
    if (key in env.subs)       await callSub(env.subs[key], args, env);
    else if (key in env.funcs) await callUserFunc(env.funcs[key], args, env);
    else if (key in BUILTINS)  BUILTINS[key](args, env);
  }

  async function execSelect(s, env) {
    var val = await evalExpr(s.expr, env);
    for (var i = 0; i < s.cases.length; i++) {
      var c = s.cases[i];
      var hit = false;
      for (var j = 0; j < c.exprs.length && !hit; j++) {
        var ce = c.exprs[j];
        if (ce.kind === "EXPR") { hit = (await evalExpr(ce.expr, env)) == val; }
        else if (ce.kind === "RANGE") {
          var lo = await evalExpr(ce.lo, env), hi = await evalExpr(ce.hi, env);
          hit = val >= lo && val <= hi;
        } else if (ce.kind === "IS") {
          var rv = await evalExpr(ce.expr, env);
          switch (ce.op) {
            case "=":  hit = val == rv; break;  case "<>": hit = val != rv; break;
            case "<":  hit = val < rv;  break;  case ">":  hit = val > rv;  break;
            case "<=": hit = val <= rv; break;  case ">=": hit = val >= rv; break;
          }
        }
      }
      if (hit) { await execBlock(c.body, env); return; }
    }
    if (s.default) await execBlock(s.default, env);
  }

  async function execRead(s, env) {
    for (var i = 0; i < s.vars.length; i++) {
      var lv = s.vars[i];
      if (env.dataPos >= env.data.length) throw new Error("Out of DATA");
      var val = env.data[env.dataPos++];
      if (lv.indices.length) {
        var idxs = [];
        for (var j = 0; j < lv.indices.length; j++) idxs.push(await evalExpr(lv.indices[j], env));
        setArr(env, lv.name, idxs, val);
      } else {
        setVar(env, lv.name, val);
      }
    }
  }

  function execRestore(s, env) {
    env.dataPos = 0;
  }

  async function execSwap(s, env) {
    async function getLv(lv) {
      if (!lv.indices.length) return getVar(env, lv.name);
      var idxs = [];
      for (var i = 0; i < lv.indices.length; i++) idxs.push(await evalExpr(lv.indices[i], env));
      return getArr(env, lv.name, idxs);
    }
    async function setLv(lv, v) {
      if (!lv.indices.length) { setVar(env, lv.name, v); return; }
      var idxs = [];
      for (var i = 0; i < lv.indices.length; i++) idxs.push(await evalExpr(lv.indices[i], env));
      setArr(env, lv.name, idxs, v);
    }
    var a = await getLv(s.a), b = await getLv(s.b);
    await setLv(s.a, b);
    await setLv(s.b, a);
  }

  async function execOn(s, env) {
    var idx = Math.round(await evalExpr(s.expr, env));
    if (idx >= 1 && idx <= s.targets.length)
      throw { qbSignal: s.kw, target: s.targets[idx - 1] };
  }

  function execExit(s) {
    var w = s.what ? s.what.toUpperCase() : "";
    if (w === "FOR")      throw { qbSignal: "EXIT", what: "FOR" };
    if (w === "DO")       throw { qbSignal: "EXIT", what: "DO" };
    if (w === "SUB")      throw { qbSignal: "EXIT_SUB" };
    if (w === "FUNCTION") throw { qbSignal: "EXIT_FUNCTION" };
  }

  // ---- SUB / FUNCTION calls ----

  function makeLocalEnv(callerEnv) {
    return {
      vars:    Object.create(null),
      arrays:  Object.create(null),
      subs:    callerEnv.subs,
      funcs:   callerEnv.funcs,
      data:    callerEnv.data,
      dataPos: callerEnv.dataPos,
      base:    callerEnv.base
    };
  }

  function bindParams(def, args, localEnv) {
    def.params.forEach(function(p, i) {
      var pn = p.name.replace(/\(\)$/, "");
      setVar(localEnv, pn, args[i] !== undefined ? args[i] : (pn.slice(-1) === "$" ? "" : 0));
    });
  }

  async function callSub(def, args, callerEnv) {
    var local = makeLocalEnv(callerEnv);
    bindParams(def, args, local);
    try { await execRunnable(def.body, local); }
    catch (sig) { if (!sig || sig.qbSignal !== "EXIT_SUB") throw sig; }
    callerEnv.dataPos = local.dataPos;
  }

  async function callUserFunc(def, args, callerEnv) {
    var local = makeLocalEnv(callerEnv);
    bindParams(def, args, local);
    try { await execRunnable(def.body, local); }
    catch (sig) { if (!sig || sig.qbSignal !== "EXIT_FUNCTION") throw sig; }
    callerEnv.dataPos = local.dataPos;
    var retKey = fnKey(def.name);
    return local.vars[retKey] !== undefined ? local.vars[retKey] : (def.name.slice(-1) === "$" ? "" : 0);
  }

  // ---- Interpreter entry point ----

  async function interpret(stmts) {
    var env = {
      vars:    Object.create(null),
      arrays:  Object.create(null),
      subs:    Object.create(null),
      funcs:   Object.create(null),
      data:    [],
      dataPos: 0,
      base:    0
    };
    stmts.forEach(function(s) {
      if (!s) return;
      if (s.type === "SUB")      env.subs[s.name.toUpperCase()] = s;
      if (s.type === "FUNCTION") env.funcs[fnKey(s.name)] = s;
      if (s.type === "DATA")     s.values.forEach(function(v) { env.data.push(v.val); });
    });
    await execRunnable(stmts, env);
  }

  // --- Run ---

  async function doRun() {
    if (running) return;
    consoleClear();
    printCol = 0;
    currentColor = null;
    stopRequested = false;
    yieldCounter = 0;
    var src = editor.value.trim();
    if (!src) return;
    var parsed = parse(lex(src));
    if (!parsed.ok) { consolePrint("Syntax error: " + parsed.error + "\n"); return; }

    running = true;
    document.getElementById("btn-run").style.display = "none";
    document.getElementById("btn-stop").style.display = "";
    editor.readOnly = true;
    setStatus("Running...");

    try {
      await interpret(parsed.stmts);
      consolePrint(stopRequested ? "\nStopped.\n" : "\nOk\n");
      setStatus(stopRequested ? "Stopped" : "Done");
    } catch (e) {
      consolePrint("\nRuntime error: " + (e && e.message ? e.message : String(e)) + "\n");
      setStatus("Error");
    } finally {
      running = false;
      document.getElementById("btn-run").style.display = "";
      document.getElementById("btn-stop").style.display = "none";
      editor.readOnly = false;
    }
  }

  // --- Status ---

  function setStatus(msg) {
    statusMsg.textContent = msg;
  }

  // --- Divider drag ---

  function setupDivider() {
    var divider = document.getElementById("divider");
    var editorPanel = document.getElementById("editor-panel");
    var consolePanel = document.getElementById("console-panel");
    var dragging = false;

    divider.addEventListener("mousedown", function (e) {
      dragging = true;
      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var main = document.getElementById("main");
      var rect = main.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var pct = (x / rect.width) * 100;
      pct = Math.max(15, Math.min(85, pct));
      editorPanel.style.flex = "none";
      editorPanel.style.width = pct + "%";
      consolePanel.style.flex = "none";
      consolePanel.style.width = (100 - pct) + "%";
    });

    document.addEventListener("mouseup", function () {
      dragging = false;
    });
  }

  // --- Editor ---

  function autoUppercaseLine(line) {
    var out = "";
    var i = 0;
    while (i < line.length) {
      var ch = line[i];
      if (ch === '"') {
        out += ch; i++;
        while (i < line.length && line[i] !== '"') out += line[i++];
        if (i < line.length) { out += '"'; i++; }
        continue;
      }
      if (ch === "'") { out += line.substring(i); break; }
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
        var j = i;
        while (j < line.length && (line[j] >= 'a' && line[j] <= 'z' || line[j] >= 'A' && line[j] <= 'Z' ||
               line[j] >= '0' && line[j] <= '9' || line[j] === '_')) j++;
        if (j < line.length && "$%&!#".indexOf(line[j]) >= 0) j++;
        var word = line.substring(i, j);
        var base = word.replace(/[$%&!#]$/, "").toUpperCase();
        if (base === "REM") { out += "REM" + line.substring(j); break; }
        out += KEYWORDS.has(base) ? base + word.substring(base.length) : word;
        i = j;
        continue;
      }
      out += ch; i++;
    }
    return out;
  }

  function setupEditor() {
    editor.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + "    " + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
      }
      if (e.key === "Enter") {
        setTimeout(function () {
          var pos = editor.selectionStart;
          var text = editor.value;
          var prevLineEnd = pos - 1;
          var prevLineStart = text.lastIndexOf("\n", prevLineEnd - 1) + 1;
          var prevLine = text.substring(prevLineStart, prevLineEnd);
          var uppercased = autoUppercaseLine(prevLine);
          if (uppercased !== prevLine) {
            editor.value = text.substring(0, prevLineStart) + uppercased + text.substring(prevLineEnd);
            editor.selectionStart = editor.selectionEnd = pos;
          }
        }, 0);
      }
    });

    editor.placeholder = "' Type your QBasic program here\n\nPRINT \"Hello, World!\"";
  }

  // --- Keyboard shortcuts ---

  document.addEventListener("keydown", function (e) {
    if (e.key === "F5") {
      e.preventDefault();
      if (!running) doRun();
    }
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSave();
    }
    if (e.key === "Escape") {
      modalHide();
    }
  });

  // --- Menu wiring ---

  document.getElementById("menu-new").addEventListener("click", doNew);
  document.getElementById("menu-open").addEventListener("click", doOpen);
  document.getElementById("menu-save").addEventListener("click", doSave);
  document.getElementById("menu-saveas").addEventListener("click", doSaveAs);
  document.getElementById("menu-clearfiles").addEventListener("click", doClearFiles);
  document.getElementById("menu-start").addEventListener("click", doRun);
  document.getElementById("btn-run").addEventListener("click", doRun);
  document.getElementById("btn-stop").addEventListener("click", function() {
    stopRequested = true;
    if (consoleInputEl._cancel) { consoleInputEl._cancel(); }
  });

  var EXAMPLES = {
    "example-hello": [
      'PRINT "Hello, World!"',
      'PRINT',
      'FOR i = 1 TO 5',
      '    PRINT "  Line "; i',
      'NEXT i'
    ].join("\n"),

    "example-fizzbuzz": [
      'FOR i = 1 TO 20',
      '    IF i MOD 15 = 0 THEN',
      '        PRINT "FizzBuzz"',
      '    ELSEIF i MOD 3 = 0 THEN',
      '        PRINT "Fizz"',
      '    ELSEIF i MOD 5 = 0 THEN',
      '        PRINT "Buzz"',
      '    ELSE',
      '        PRINT i',
      '    END IF',
      'NEXT i'
    ].join("\n"),

    "example-fibonacci": [
      'DIM fib(25)',
      'fib(1) = 1',
      'fib(2) = 1',
      'FOR i = 3 TO 25',
      '    fib(i) = fib(i-1) + fib(i-2)',
      'NEXT i',
      'PRINT "Fibonacci numbers:"',
      'FOR i = 1 TO 25',
      '    PRINT fib(i);',
      'NEXT i',
      'PRINT'
    ].join("\n"),

    "example-guess": [
      'RANDOMIZE TIMER',
      'secret = INT(RND * 100) + 1',
      'tries = 0',
      'PRINT "Guess a number between 1 and 100"',
      'DO',
      '    INPUT "Your guess: ", guess',
      '    tries = tries + 1',
      '    IF guess < secret THEN',
      '        PRINT "Too low!"',
      '    ELSEIF guess > secret THEN',
      '        PRINT "Too high!"',
      '    ELSE',
      '        PRINT "Correct! You got it in "; tries; " tries."',
      '    END IF',
      'LOOP UNTIL guess = secret'
    ].join("\n"),

    "example-sort": [
      'DIM a(10)',
      'DATA 64, 34, 25, 12, 22, 11, 90, 45, 67, 1',
      'FOR i = 1 TO 10',
      '    READ a(i)',
      'NEXT i',
      'PRINT "Before sort:"',
      'FOR i = 1 TO 10 : PRINT a(i); : NEXT i',
      'PRINT',
      'FOR i = 1 TO 9',
      '    FOR j = 1 TO 10 - i',
      '        IF a(j) > a(j+1) THEN SWAP a(j), a(j+1)',
      '    NEXT j',
      'NEXT i',
      'PRINT "After sort:"',
      'FOR i = 1 TO 10 : PRINT a(i); : NEXT i',
      'PRINT'
    ].join("\n")
  };

  Object.keys(EXAMPLES).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function() {
      editor.value = EXAMPLES[id];
      currentFile = null;
      statusFilename.textContent = "Untitled";
      setStatus("Example loaded");
    });
  });

  // --- Init ---

  setupDivider();
  setupEditor();
  setStatus("Ready");

  return {
    consolePrint: consolePrint,
    consoleClear: consoleClear,
    run: doRun,
    lex: lex,
    parse: parse,
    interpret: interpret,
    TT: TT
  };

})();
