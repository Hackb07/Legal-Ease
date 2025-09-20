// JavaScript code for the LegalEase application
// This file manages the app's state, handles user interactions, makes API calls, and updates the UI based on user actions.

let state = {
    selectedFile: null,
    simplifiedContent: null,
    isLoading: false,
    isChatLoading: false,
    error: null,
    chatHistory: [],
    activeTab: 'simplify',
    activePage: 'home',
};

const dom = {
    pages: document.querySelectorAll('.page'),
    navButtons: document.querySelectorAll('.nav-btn'),
    languageSelect: document.getElementById('language-select'),
    fileInput: document.getElementById('file-input'),
    uploadBtn: document.getElementById('upload-btn'),
    scanBtn: document.getElementById('scan-btn'),
    fileNameDisplay: document.getElementById('file-name-display'),
    simplifyBtn: document.getElementById('simplify-btn'),
    simplifyBtnContent: document.getElementById('simplify-btn-content'),
    simplifyLoader: document.getElementById('simplify-loader'),
    clearBtn: document.getElementById('clear-btn'),
    errorDisplay: document.getElementById('error-display'),
    errorMessage: document.getElementById('error-message'),
    closeErrorBtn: document.getElementById('close-error-btn'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    chatTabBtn: document.getElementById('chat-tab-btn'),
    simplifiedContentArea: document.getElementById('simplified-content-area'),
    simplifyPlaceholder: document.getElementById('simplify-placeholder'),
    simplifyContentLoader: document.getElementById('simplify-content-loader'),
    chatHistory: document.getElementById('chat-history'),
    chatForm: document.getElementById('chat-form'),
    userQueryInput: document.getElementById('user-query'),
    sendBtn: document.getElementById('send-btn'),
};

const LANGUAGES = [ "English", "Hindi (हिन्दी)", "Bengali (বাংলা)", "Telugu (తెలుగు)", "Marathi (मराठी)", "Tamil (தமிழ்)", "Urdu (اردو)", "Gujarati (ગુજરાતી)", "Kannada (ಕನ್ನಡ)", "Odia (ଓଡିଆ)", "Malayalam (മലയാളം)", "Punjabi (ਪੰਜਾਬੀ)" ];
const API_KEY = "AIzaSyDxRpZvB045File2KI81Ci9hVb4JI4yYuM"; // Keep this empty
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

const markdownToHtml = (text) => {
    return text
        .replace(/^Disclaimer: (.*)$/gm, '<p class="p-3 bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 rounded-r-lg text-sm mb-4">$1</p>')
        .replace(/### (.*?)\n/g, '<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">$1</h3>')
        .replace(/\* (.*?)\n/g, '<li class="ml-5 list-disc">$1</li>')
        .replace(/\n/g, '<br />');
}

const makeApiCall = async (payload) => {
    let retries = 3, delay = 1000;
    while (retries > 0) {
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
            const result = await response.json();
            const candidate = result.candidates?.[0];
            if (candidate && candidate.content?.parts?.[0]?.text) {
                return candidate.content.parts[0].text;
            } else throw new Error("Could not extract text from API response.");
        } catch (err) {
            console.error(`API call failed. Retries left: ${retries - 1}`, err);
            retries--;
            if (retries === 0) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
};

const render = () => {
    dom.simplifyBtn.disabled = state.isLoading || !state.selectedFile;
    dom.sendBtn.disabled = state.isChatLoading || !dom.userQueryInput.value.trim();
    dom.chatTabBtn.disabled = !state.simplifiedContent;

    dom.simplifyBtnContent.classList.toggle('hidden', state.isLoading);
    dom.simplifyLoader.classList.toggle('hidden', !state.isLoading);
    dom.simplifyContentLoader.style.display = state.isLoading ? 'flex' : 'none';
    dom.simplifyPlaceholder.style.display = !state.isLoading && !state.simplifiedContent ? 'flex' : 'none';

    dom.errorDisplay.style.display = state.error ? 'flex' : 'none';
    dom.errorMessage.textContent = state.error;

    dom.pages.forEach(p => p.classList.toggle('active', p.id === `page-${state.activePage}`));
    dom.navButtons.forEach(b => {
        const isActive = b.dataset.page === state.activePage;
        b.classList.toggle('text-blue-600', isActive);
        b.classList.toggle('dark:text-blue-400', isActive);
        b.classList.toggle('text-gray-500', !isActive);
        b.classList.toggle('dark:text-gray-400', !isActive);
    });

    dom.tabButtons.forEach(b => {
        const isActive = b.dataset.tab === state.activeTab;
        b.classList.toggle('text-blue-600', isActive);
        b.classList.toggle('border-b-2', isActive);
        b.classList.toggle('border-blue-600', isActive);
        b.classList.toggle('text-gray-500', !isActive);
    });
    dom.tabContents.forEach(c => c.classList.toggle('hidden', c.id !== `tab-content-${state.activeTab}`));
    
    dom.simplifiedContentArea.innerHTML = state.simplifiedContent ? markdownToHtml(state.simplifiedContent) : '';
    if (state.simplifiedContent) {
        dom.simplifyPlaceholder.style.display = 'none';
    }

    if (state.activeTab === 'chat') {
        dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;
    }
};

const handleSimplify = async () => {
    if (!state.selectedFile) {
        state.error = "Please upload a file first.";
        render();
        return;
    }
    state.isLoading = true;
    state.error = null;
    state.simplifiedContent = null;
    render();

    const systemPrompt = `Act as an AI legal assistant, LegalEase... Rules: 1. ... 2. ... 3. Translate to ${dom.languageSelect.value}. 4. ... 5. ...`;

    try {
        const base64Data = await fileToBase64(state.selectedFile);
        const payload = { contents: [{ parts: [{ text: "Extract text from this document and then simplify it." }, { inline_data: { mime_type: state.selectedFile.type, data: base64Data } }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, };
        const resultText = await makeApiCall(payload);
        state.simplifiedContent = resultText;
        state.chatHistory = [];
    } catch (err) {
        state.error = err.message;
    } finally {
        state.isLoading = false;
        render();
    }
};

const handleChatSubmit = async (e) => {
    e.preventDefault();
    const userQuery = dom.userQueryInput.value.trim();
    if (!userQuery || state.isChatLoading) return;
    
    state.chatHistory.push({ role: 'user', text: userQuery });
    dom.chatHistory.innerHTML += `<div class="flex items-start gap-2 justify-end"><div class="max-w-xs p-2.5 rounded-xl bg-blue-600 text-white"><p class="text-sm whitespace-pre-wrap">${userQuery}</p></div><i data-lucide="user" class="w-5 h-5 text-gray-500 flex-shrink-0 mt-1"></i></div>`;
    lucide.createIcons();
    dom.userQueryInput.value = '';
    
    state.isChatLoading = true;
    render();

    const loaderId = `loader-${Date.now()}`;
    dom.chatHistory.innerHTML += `<div id="${loaderId}" class="flex items-start gap-2"><i data-lucide="bot" class="w-5 h-5 text-blue-500 mt-1"></i><div class="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700"><div class="flex items-center gap-1.5"><span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span><span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span></div></div></div>`;
    lucide.createIcons();
    dom.chatHistory.scrollTop = dom.chatHistory.scrollHeight;

    const systemPrompt = `You are LegalEase... answer questions based *only* on the provided context... Rules: 1. ... 2. ... 3. ... 4. Translate to ${dom.languageSelect.value}. 5. ...`;
    const contextText = `Context from document "${state.selectedFile.name}".`;
    const fullPrompt = `CONTEXT: """${contextText}""" \n\n QUESTION: "${userQuery}"`;
    const payload = { contents: [{ parts: [{ text: fullPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, };

    try {
        const resultText = await makeApiCall(payload);
        state.chatHistory.push({ role: 'model', text: resultText });
        document.getElementById(loaderId).remove();
        dom.chatHistory.innerHTML += `<div class="flex items-start gap-2"><i data-lucide="bot" class="w-5 h-5 text-blue-500 flex-shrink-0 mt-1"></i><div class="max-w-xs p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700"><p class="text-sm whitespace-pre-wrap">${resultText}</p></div></div>`;
        lucide.createIcons();
    } catch (err) {
        document.getElementById(loaderId).remove();
        dom.chatHistory.innerHTML += `<div class="flex items-start gap-2"><i data-lucide="bot" class="w-5 h-5 text-red-500 flex-shrink-0 mt-1"></i><div class="max-w-xs p-2.5 rounded-xl bg-red-100 dark:bg-red-700"><p class="text-sm text-red-700 dark:text-red-200">Error: ${err.message}</p></div></div>`;
        lucide.createIcons();
    } finally {
        state.isChatLoading = false;
        render();
    }
};

const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
        state.error = "File is too large. Max 4MB.";
        state.selectedFile = null;
        dom.fileNameDisplay.textContent = "Select a PDF or Image (max 4MB)";
    } else {
        state.selectedFile = file;
        dom.fileNameDisplay.textContent = file.name;
        state.error = null;
    }
    render();
};

const handleClear = () => {
    state.selectedFile = null;
    state.simplifiedContent = null;
    state.isLoading = false;
    state.error = null;
    state.chatHistory = [];
    state.activeTab = 'simplify';
    dom.fileInput.value = "";
    dom.fileNameDisplay.textContent = "Select a PDF or Image (max 4MB)";
    dom.chatHistory.innerHTML = `<div class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm"><i data-lucide="bot" class="w-5 h-5 text-blue-500 flex-shrink-0 mt-1"></i><p>Ask me anything about the document.</p></div>`;
    lucide.createIcons();
    render();
};

const init = () => {
    dom.languageSelect.innerHTML = LANGUAGES.map(lang => `<option value="${lang}">${lang}</option>`).join('');

    dom.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            state.activePage = btn.dataset.page;
            render();
        });
    });

    dom.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!btn.disabled) {
                state.activeTab = btn.dataset.tab;
                render();
            }
        });
    });

    dom.uploadBtn.addEventListener('click', () => dom.fileInput.click());
    dom.scanBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', handleFileChange);
    dom.simplifyBtn.addEventListener('click', handleSimplify);
    dom.clearBtn.addEventListener('click', handleClear);
    dom.closeErrorBtn.addEventListener('click', () => { state.error = null; render(); });
    dom.chatForm.addEventListener('submit', handleChatSubmit);
    dom.userQueryInput.addEventListener('input', render);
    
    lucide.createIcons();
    render();
};

document.addEventListener('DOMContentLoaded', init);