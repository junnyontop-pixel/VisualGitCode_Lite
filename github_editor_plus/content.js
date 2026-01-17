(function() {
    const VS_CODE_MENU = '#252526';
    const VS_CODE_HOVER = '#2a2d2e';
    const VS_CODE_TEXT = '#cccccc';

    const SUGGEST_DATA = {
        javascript: {
            icon: '{}',
            color: '#569cd6',
            keywords: ['async', 'await', 'class', 'const', 'function', 'let', 'return', 'var', 'if', 'else'] // (생략)
        },
        html: {
            icon: '<>',
            color: '#e34c26',
            keywords: ['!', 'div', 'span', 'p', 'a', 'h1', 'h2', 'img', 'button', 'input', 'script', 'style', 'body', 'head']
        },
        css: {
            icon: '#',
            color: '#569cd6',
            keywords: ['color', 'background', 'margin', 'padding', 'display', 'flex', 'font-size', 'border', 'width', 'height']
        }
    };

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
        
        // ✅ 이것만 남겨두면 돼
        contentEditable.addEventListener("mousedown", closePopup);
        state.activeEditor = contentEditable;
    }

    // html 전용 기능
    function handleHTMLAutoClose(e) {
        if (e.key === "Enter") { // 1. Enter는 첫 글자가 대문자여야 안전해!
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            
            const textBefore = range.startContainer.textContent.slice(0, range.startOffset);
            const lastWordMatch = textBefore.match(/(\w+)$/);

            if (lastWordMatch) {
                e.preventDefault();

                const tagName = lastWordMatch[0];
                const expandedTag = `<${tagName}></${tagName}>`;

                // ⚠️ 2. [가장 중요] 단어 "p"를 먼저 지워줘야 해!
                // 현재 커서 위치에서 단어 길이만큼 뒤로 범위를 넓혀서 선택하기
                range.setStart(range.startContainer, range.startOffset - tagName.length);
                range.deleteContents(); // 이제 "p"가 지워짐!

                const newNode = document.createTextNode(expandedTag);
                range.insertNode(newNode);

                // 4. 커서를 태그 사이로 이동시키기
                const newRange = document.createRange();
                const cursorPosition = tagName.length + 2; 
                
                newRange.setStart(newNode, cursorPosition);
                newRange.setEnd(newNode, cursorPosition);

                // ⚠️ 3. 브라우저에게 "이 새로운 범위를 봐!"라고 알려줘야 해
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }

    // JS 전용 기능 모음
    function handleJSAssist(e) {
        // 여기에 JS 전용 기능 추가 예정
    }

    // CSS 전용 기능 모음
    function handleCSSAssist(e) {
        if (e.key === ':') {
            e.preventDefault(); // 기본 ':' 입력을 막고

            const selection = window.getSelection();
            const range = selection.getRangeAt(0);

            // ': ;'를 한꺼번에 넣기
            const newNode = document.createTextNode(': ;');
            range.deleteContents();
            range.insertNode(newNode);

            // 커서를 ':' 와 ';' 사이로 옮기기
            const newRange = document.createRange();
            newRange.setStart(newNode, 2); 
            newRange.setEnd(newNode, 2);

            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    // 괄호 자동완성 기능 분리
    function handleBrackets(e) {
        const brackets = {
            '(': ')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'"
        };

        const closeBracket = brackets[e.key];
        if (!closeBracket) return; // 괄호가 아니면 그냥 종료

        e.preventDefault(); // 기본 입력 막기 (우리가 직접 제어할 거니까!)

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        
        // 1. 여는 괄호와 닫는 괄호를 합친 텍스트 노드 만들기
        const text = e.key + closeBracket;
        const newNode = document.createTextNode(text);

        // 2. 현재 커서 위치에 노드 넣기
        range.deleteContents();
        range.insertNode(newNode);

        // 3. 커서를 괄호 사이로 옮기기 (Selection API의 마법!)
        const newRange = document.createRange();
        newRange.setStart(newNode, 1); // 괄호 사이(index 1)에 커서 두기
        newRange.setEnd(newNode, 1);
        
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    // 현재 파일의 언어를 확인하는 함수
    function getEditorLanguage() {
        // 1. 네가 찾은 클래스명으로 요소 찾기
        const fileInputElement = document.querySelector('.prc-components-Input-IwWrt'); 
        
        // 2. 요소가 있고 value가 있는지 확인
        if (fileInputElement && fileInputElement.value) {
            const fileName = fileInputElement.value.toLowerCase();

            if (fileName.endsWith('.html')) return 'html';
            if (fileName.endsWith('.css')) return 'css';
            if (fileName.endsWith('.js')) return 'javascript';
        }

        // 3. 만약 요소를 못 찾으면 URL 방식이라도 써서 백업!
        const url = window.location.href.toLowerCase();
        if (url.includes('.html')) return 'html';
        if (url.includes('.css')) return 'css';
        if (url.includes('.js')) return 'javascript';
        
        return 'unknown';
    }

    // 언어 별 전용 기능 구현
    document.addEventListener('keydown', (e) => {
        const lang = getEditorLanguage();

        // 1. 팝업이 열려있을 때의 키보드 제어 (언어 상관없이 공통!)
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

        // 2. 공통 기능 (괄호 자동완성)
        const brackets = ['(', '[', '{', '"', "'"];
        if (brackets.includes(e.key)) {
            handleBrackets(e);
            return;
        }

        // 3. 언어별 특화 기능
        if (lang === 'html') {
            handleHTMLAutoClose(e); 
        } else if (lang === 'css') {
            handleCSSAssist(e);
        } else if (lang === 'javascript') {
            handleJSAssist(e);
        }
        
        // 4. 모든 언어에서 글자를 치면 팝업 트리거 (JS 전용이 아님!)
        setTimeout(triggerSuggest, 0);

    }, true);

    function triggerSuggest() {
        const lang = getEditorLanguage();
        if (!SUGGEST_DATA[lang]) { // 지원하지 않는 언어면 팝업 닫기
            closePopup();
            return;
        }
        
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const offset = range.startOffset;
        
        // 커서 직전의 텍스트 추출 (특수문자 제외 단어만)
        const textBefore = node.nodeType === 3 ? node.textContent.substring(0, offset) : "";
        const match = textBefore.match(/([a-zA-Z0-9_!]+)$/);
        
        if (!match) {
            closePopup();
            return;
        }

        const inputWord = match[1].toLowerCase();
        state.currentWord = match[1];
        state.startOffset = offset - inputWord.length;

        // [핵심 수정] 부분 일치하는 모든 키워드 검색
        state.currentMatches = SUGGEST_DATA[lang].keywords.filter(k => 
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
        // 1. 현재 어떤 언어인지 알아내기
        const lang = getEditorLanguage(); 
        
        // 2. 그 언어에 해당하는 데이터(아이콘, 색상 등)를 info에 담기
        const info = SUGGEST_DATA[lang]; 

        // 만약 데이터가 없는 언어라면 안전하게 중단
        if (!info) return;

        // 3. 이제 info.color와 info.icon을 마음껏 사용!
        state.popup.innerHTML = state.currentMatches.map((m, i) => `
            <div class="vscode-item ${i === state.selectedIndex ? 'selected' : ''}" data-index="${i}">
                <span class="vscode-icon" style="color: ${info.color}">${info.icon}</span>
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

        const lang = getEditorLanguage();
        const info = SUGGEST_DATA[lang];
        if (!info) return;

        const sel = window.getSelection();
        const range = sel.getRangeAt(0);
        const node = range.startContainer;

        // 1. 기존에 입력 중이던 글자 지우기
        const textAfter = node.textContent.substring(state.startOffset);
        const fullWordMatch = textAfter.match(/^\w+/);
        const lengthToDelete = state.currentWord.length;

        range.setStart(node, state.startOffset);
        range.setEnd(node, state.startOffset + lengthToDelete);
        range.deleteContents();

        // 2. 최종 문자열(finalWord) 결정
        let finalWord = word;
        if (lang === 'html') {
            if (word === '!') {
                // 커서가 들어갈 위치에 딱 | 표시를 해둬
                finalWord = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>Document</title>
</head>
<body>
    |
</body>
</html>`;
            } else {
                finalWord = `<${word}></${word}>`;
            }
        }

        // 3. 텍스트 노드 생성 및 에디터에 삽입
        const textNode = document.createTextNode(finalWord);
        range.insertNode(textNode);

        // 4. 커서 위치 잡기 (마법 로직)
        const newRange = document.createRange();
        
        if (lang === 'html' && word === '!') {
            // | 기호의 위치를 찾아서 커서를 보낸 뒤 | 만 지우기
            const pipeIndex = finalWord.indexOf('|');
            
            // 커서 범위를 | 글자 하나로 지정
            newRange.setStart(textNode, pipeIndex);
            newRange.setEnd(textNode, pipeIndex + 1);
            
            // 선택된 | 삭제
            newRange.deleteContents();
            
            // 지워진 그 자리에 커서 고정
            newRange.setStart(textNode, pipeIndex);
            newRange.setEnd(textNode, pipeIndex);
        } else if (lang === 'html') {
            // 일반 태그: 태그 사이 (<p>|</p>)
            const middleOffset = word.length + 2;
            newRange.setStart(textNode, middleOffset);
            newRange.setEnd(textNode, middleOffset);
        } else {
            // JS/CSS: 단어 바로 뒤
            newRange.setStartAfter(textNode);
            newRange.setEndAfter(textNode);
        }

        // 5. 변경된 커서 위치 적용
        sel.removeAllRanges();
        sel.addRange(newRange);

        closePopup();
        
        // 에디터에 변화가 생겼음을 알림
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