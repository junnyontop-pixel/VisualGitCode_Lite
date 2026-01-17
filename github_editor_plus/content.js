(function() {
    const VS_CODE_MENU = '#252526';
    const VS_CODE_HOVER = '#2a2d2e';
    const VS_CODE_TEXT = '#cccccc';

    const keywords = [
        'async', 'await', 'class', 'const', 'constructor', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
    ].sort();

    let state = {
        popup: null,
        selectedIndex: 0,
        currentMatches: [],
        currentWord: '',
        activeEditor: null,
        startOffset: 0
    };

    const style = document.createElement('style');
    style.textContent = `
        .vscode-popup {
            position: absolute; background: ${VS_CODE_MENU}; border: 1px solid #454545;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 10000; font-family: 'Consolas', monospace;
            min-width: 240px; border-radius: 3px; overflow: hidden; color: ${VS_CODE_TEXT};
        }
        .vscode-item { padding: 5px 12px; cursor: pointer; display: flex; align-items: center; font-size: 13px; }
        .vscode-item.selected { background: #094771; color: white; }
        .vscode-item:hover:not(.selected) { background: ${VS_CODE_HOVER}; }
        .vscode-icon { margin-right: 10px; width: 14px; opacity: 0.7; font-size: 10px; color: #569cd6; font-weight: bold; }
    `;
    document.head.appendChild(style);

    function init() {
        const editor = document.querySelector(".cm-editor");
        if (!editor || editor.dataset.vscEnhanced) return;

        editor.dataset.vscEnhanced = "true";
        const contentEditable = editor.querySelector("[contenteditable='true']");
        
        contentEditable.addEventListener("keydown", handleKeyDown, true);
        contentEditable.addEventListener("mousedown", closePopup);
        state.activeEditor = contentEditable;
    }

    function handleKeyDown(e) {
        if (state.popup) {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); return; }
            if (e.key === 'Enter' || e.key === 'Tab') {
                if (state.currentMatches.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    applyWord(state.currentMatches[state.selectedIndex]);
                    return;
                }
            }
            if (e.key === 'Escape') { closePopup(); return; }
        }

        // 1. 괄호가 입력되면 일단 팝업은 무조건 닫기
        if (["(", "[", "{", "'", '"'].includes(e.key)) {
            closePopup(); 

            // 2. 괄호 자동 완성 로직
            if (e.key === "(") {
                e.preventDefault(); // 원래 써지려던 '(' 한 개를 취소해
                document.execCommand('insertText', false, "()"); // 대신 "()" 두 개를 넣어
                
                // 3. 커서를 괄호 사이로 옮기기
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 1); // 커서를 왼쪽으로 한 칸 이동
                range.collapse(true); // 이동한 위치로 고정
                sel.removeAllRanges();
                sel.addRange(range);
            }
            if (e.key === "{") {
                e.preventDefault(); // 원래 써지려던 '{' 한 개를 취소해
                document.execCommand('insertText', false, "{}"); // 대신 "{}" 두 개를 넣어
                
                // 3. 커서를 괄호 사이로 옮기기
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 1); // 커서를 왼쪽으로 한 칸 이동
                range.collapse(true); // 이동한 위치로 고정
                sel.removeAllRanges();
                sel.addRange(range);
            }
            if (e.key === "[") {
                e.preventDefault(); // 원래 써지려던 '[' 한 개를 취소해
                document.execCommand('insertText', false, "[]"); // 대신 "[]" 두 개를 넣어
                
                // 3. 커서를 괄호 사이로 옮기기
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 1); // 커서를 왼쪽으로 한 칸 이동
                range.collapse(true); // 이동한 위치로 고정
                sel.removeAllRanges();
                sel.addRange(range);
            }
            if (e.key === "'") {
                e.preventDefault(); // 원래 써지려던 ` ' ` 한 개를 취소해
                document.execCommand('insertText', false, "''"); // 대신 "''" 두 개를 넣어
                
                // 3. 커서를 괄호 사이로 옮기기
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 1); // 커서를 왼쪽으로 한 칸 이동
                range.collapse(true); // 이동한 위치로 고정
                sel.removeAllRanges();
                sel.addRange(range);
            }
            if (e.key === '"') {
                e.preventDefault(); // 원래 써지려던 ` " ` 한 개를 취소해
                document.execCommand('insertText', false, '""'); // 대신 '""' 두 개를 넣어
                
                // 3. 커서를 괄호 사이로 옮기기
                const sel = window.getSelection();
                const range = sel.getRangeAt(0);
                range.setStart(range.startContainer, range.startOffset - 1); // 커서를 왼쪽으로 한 칸 이동
                range.collapse(true); // 이동한 위치로 고정
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
        // 키 입력 후 즉시 트리거 (딜레이 최소화)
        setTimeout(triggerSuggest, 0);
    }

    function triggerSuggest() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        
        // 커서 직전의 텍스트 추출 (특수문자 제외 단어만)
        const textBefore = node.nodeType === 3 ? node.textContent.substring(0, offset) : "";
        const match = textBefore.match(/([a-zA-Z0-9_]+)$/);
        
        if (!match) {
            closePopup();
            return;
        }

        const inputWord = match[1].toLowerCase();
        state.currentWord = match[1];
        state.startOffset = offset - inputWord.length;

        // [핵심 수정] 부분 일치하는 모든 키워드 검색
        state.currentMatches = keywords.filter(k => 
            k.toLowerCase().includes(inputWord)
        );

        // 결과가 하나라도 있으면 팝업 유지/생성
        if (state.currentMatches.length > 0) {
            showPopup(range);
        } else {
            closePopup();
        }
    }

    function showPopup(range) {
        if (!state.popup) {
            state.popup = document.createElement('div');
            state.popup.className = 'vscode-popup';
            document.body.appendChild(state.popup);
        }

        const rect = range.getBoundingClientRect();
        state.popup.style.top = `${window.scrollY + rect.bottom + 5}px`;
        state.popup.style.left = `${window.scrollX + rect.left}px`;
        
        // 검색어가 바뀔 때마다 선택 인덱스 초기화 (항상 첫 번째 추천항목 선택)
        if (state.selectedIndex >= state.currentMatches.length) {
            state.selectedIndex = 0;
        }
        
        renderList();
    }

    function renderList() {
        state.popup.innerHTML = state.currentMatches.map((m, i) => `
            <div class="vscode-item ${i === state.selectedIndex ? 'selected' : ''}" data-index="${i}">
                <span class="vscode-icon">{}</span>
                <span>${m}</span>
            </div>
        `).join('');
        
        // 클릭 이벤트 다시 연결
        state.popup.querySelectorAll('.vscode-item').forEach(el => {
            el.onclick = (e) => {
                e.stopPropagation();
                applyWord(state.currentMatches[el.dataset.index]);
            };
        });
    }

    function moveSelection(dir) {
        state.selectedIndex = (state.selectedIndex + dir + state.currentMatches.length) % state.currentMatches.length;
        renderList();
    }

    function applyWord(word) {
        if (!word) return;
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);
        const node = range.startContainer;

        // 현재 커서 위치에서 뒤쪽으로 이어지는 단어 문자까지 포함해서 선택 범위 잡기
        const textAfter = node.textContent.substring(state.startOffset);
        const fullWordMatch = textAfter.match(/^\w+/);
        const lengthToDelete = fullWordMatch ? fullWordMatch[0].length : state.currentWord.length;

        range.setStart(node, state.startOffset);
        range.setEnd(node, state.startOffset + lengthToDelete);
        range.deleteContents();

        const textNode = document.createTextNode(word);
        range.insertNode(textNode);
        
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);

        closePopup();
        state.activeEditor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function closePopup() {
        if (state.popup) {
            state.popup.remove();
            state.popup = null;
        }
        state.selectedIndex = 0;
    }

    init();
    const observer = new MutationObserver(init);
    observer.observe(document.body, { childList: true, subtree: true });
})();