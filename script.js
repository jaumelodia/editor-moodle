window.renderMindmaps = function (container) {
    if (typeof window.markmap === 'undefined') return;
    const { Markmap } = window.markmap;

    // Simple parser: indented text to Markmap JSON
    const textToMarkmapJSON = (text) => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return { t: 'root', d: 0, v: 'Vacío', c: [] };

        const root = { t: 'root', d: 0, v: lines[0].trim(), c: [] };
        const stack = [{ node: root, indent: -1 }]; // We treat root as indent -1

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const textContent = line.trim();
            if (!textContent) continue;

            // Calculate indent by counting leading dashes
            const leadingDashesMatch = line.match(/^-+/);
            const leadingDashes = leadingDashesMatch ? leadingDashesMatch[0].length : 0;
            const textContentClean = textContent.replace(/^-+\s*/, '').trim();

            const node = { t: 'heading', d: 0, v: textContentClean || textContent, c: [] };

            // Pop stack until we find the correct parent
            while (stack.length > 1 && stack[stack.length - 1].indent >= leadingDashes) {
                stack.pop();
            }

            const parent = stack[stack.length - 1].node;
            node.d = parent.d !== undefined ? parent.d + 1 : 1;

            if (!parent.c) parent.c = [];
            parent.c.push(node);

            stack.push({ node, indent: leadingDashes });
        }

        // Cleanup empty 'c' arrays
        const cleanEmptyC = (n) => {
            if (n.c && n.c.length === 0) delete n.c;
            if (n.c) n.c.forEach(cleanEmptyC);
        };
        cleanEmptyC(root);

        return root;
    };

    // Simple serializer: JSON to indented text
    const markmapJSONToText = (node, indent = '') => {
        let text = indent + (node.v || '') + '\n';
        if (node.c && node.c.length > 0) {
            node.c.forEach(child => {
                text += markmapJSONToText(child, indent + '-'); // 1 dash per level
            });
        }
        return text;
    };

    container.querySelectorAll('.mindmap-wrapper').forEach(wrapper => {
        const svg = wrapper.querySelector('svg.mindmap');
        const dataScript = wrapper.querySelector('.markmap-data');
        const editBtn = wrapper.querySelector('.mindmap-edit-btn');
        let editorDiv = wrapper.querySelector('.mindmap-text-editor');

        if (svg && dataScript) {
            try {
                // Parse cleanly
                const rawData = JSON.parse(dataScript.textContent);

                // Deep clone 
                const data = JSON.parse(JSON.stringify(rawData));

                // Always re-render the SVG
                svg.innerHTML = '';
                const mm = Markmap.create(svg, { autoFit: true, initialExpandLevel: 2 }, data);

                // Set up center button if it exists and hasn't been set up
                const centerBtn = wrapper.querySelector('.mindmap-center-btn');
                if (centerBtn && !centerBtn.hasAttribute('data-initialized')) {
                    centerBtn.setAttribute('data-initialized', 'true');
                    centerBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        mm.fit();
                    });
                }

                // Set up edit button if it exists and hasn't been set up
                if (editBtn && !editBtn.hasAttribute('data-initialized')) {
                    editBtn.setAttribute('data-initialized', 'true');

                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const isEditing = wrapper.classList.contains('editing');

                        if (!isEditing) {
                            // ENTER EDIT MODE
                            wrapper.classList.add('editing');
                            editBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
                            editBtn.style.backgroundColor = '#10b981'; // Green for save
                            editBtn.style.color = 'white';

                            // Initialize editor div if it doesn't exist
                            if (!editorDiv) {
                                editorDiv = document.createElement('textarea');
                                editorDiv.className = 'mindmap-text-editor';
                                editorDiv.setAttribute('spellcheck', 'false');
                                wrapper.appendChild(editorDiv);
                            }

                            // Transform JSON to text
                            const currentData = JSON.parse(dataScript.textContent);
                            editorDiv.value = markmapJSONToText(currentData).trim();

                            svg.style.display = 'none';
                            editorDiv.style.display = 'block';
                            editorDiv.focus();

                        } else {
                            // EXIT EDIT MODE (SAVE)
                            wrapper.classList.remove('editing');
                            editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar Mapa Mental';
                            editBtn.style.backgroundColor = '';
                            editBtn.style.color = '';

                            if (editorDiv) {
                                // Parse text back to JSON
                                const newText = editorDiv.value;
                                const parsedJSON = textToMarkmapJSON(newText);

                                dataScript.textContent = JSON.stringify(parsedJSON);

                                editorDiv.style.display = 'none';
                                svg.style.display = 'block';

                                // Trigger a re-render
                                window.renderMindmaps(document);
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("Error parsing markmap data", e);
            }
        }
    });
};


document.addEventListener('DOMContentLoaded', () => {
    const editorCanvas = document.getElementById('editor-canvas');
    const toolBtns = document.querySelectorAll('.tool-btn[data-command]');
    const downloadDropdownBtn = document.getElementById('download-dropdown-btn');
    const downloadMenu = document.getElementById('download-menu');
    const exportHtmlBtn = document.getElementById('export-html-btn');
    const exportMdBtn = document.getElementById('export-md-btn');
    const formatSelect = document.getElementById('format-block');
    const insertSelect = document.getElementById('insert-block');
    const insertBtn = document.getElementById('insert-btn');
    const markBtn = document.getElementById('mark-btn');
    const clearBtn = document.getElementById('clear-btn');
    const imageBtn = document.getElementById('image-btn');
    const imageUpload = document.getElementById('image-upload');
    const videoBtn = document.getElementById('video-btn');

    const htmlSourceBtn = document.getElementById('html-source-btn');
    const htmlSourceEditor = document.getElementById('html-source-editor');

    // Default modes
    let isSourceMode = false;

    // Use <p> tags for line breaks instead of <div>
    document.execCommand('defaultParagraphSeparator', false, 'p');

    // --- NEW LOGIC: Exit components with Escape or Click ---
    editorCanvas.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            let node = selection.anchorNode;
            let topLevelNode = null;

            while (node && node !== editorCanvas) {
                if (node.parentNode === editorCanvas) {
                    topLevelNode = node;
                    break;
                }
                node = node.parentNode;
            }

            if (topLevelNode && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(topLevelNode.tagName)) {
                let targetP = topLevelNode.nextSibling;

                // Skip empty text nodes
                while (targetP && targetP.nodeType === 3 && targetP.textContent.trim() === '') {
                    targetP = targetP.nextSibling;
                }

                const checkEmptyP = (el) => el && el.tagName === 'P' && (el.innerHTML.trim() === '<br>' || el.innerHTML.trim() === '' || (el.textContent.trim() === '' && el.children.length === 0));

                if (!checkEmptyP(targetP)) {
                    const newP = document.createElement('p');
                    newP.innerHTML = '<br>';
                    if (topLevelNode.nextSibling) {
                        editorCanvas.insertBefore(newP, topLevelNode.nextSibling);
                    } else {
                        editorCanvas.appendChild(newP);
                    }
                    targetP = newP;
                }

                const range = document.createRange();
                range.setStart(targetP, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);

                e.preventDefault();
            }
        }
    });

    editorCanvas.addEventListener('click', (e) => {
        // Fix for Tabs inside contenteditable interacting poorly with label clicks
        if (e.target && e.target.tagName === 'LABEL' && e.target.closest('.tabs')) {
            const radioId = e.target.getAttribute('for');
            if (radioId) {
                const radio = document.getElementById(radioId);
                if (radio) {
                    radio.checked = true;
                }
            }
        }

        // Only act if clicking directly on the canvas background
        if (e.target === editorCanvas) {
            let targetNode = null;
            let insertBeforeNode = null;

            for (let i = 0; i < editorCanvas.children.length; i++) {
                const child = editorCanvas.children[i];
                const rect = child.getBoundingClientRect();

                // If the click is above the middle of the child, consider it "before" this child
                if (e.clientY < rect.top + (rect.height / 2)) {
                    insertBeforeNode = child;
                    break;
                }
            }

            const p = document.createElement('p');
            p.innerHTML = '<br>';
            const checkEmptyP = (el) => el && el.tagName === 'P' && (el.innerHTML.trim() === '<br>' || el.innerHTML.trim() === '' || (el.textContent.trim() === '' && el.children.length === 0));

            if (insertBeforeNode) {
                const prev = insertBeforeNode.previousElementSibling;
                if (!checkEmptyP(prev)) {
                    editorCanvas.insertBefore(p, insertBeforeNode);
                    targetNode = p;
                } else {
                    targetNode = prev;
                }
            } else {
                const last = editorCanvas.lastElementChild;
                if (!checkEmptyP(last)) {
                    editorCanvas.appendChild(p);
                    targetNode = p;
                } else {
                    targetNode = last;
                }
            }

            if (targetNode) {
                const range = document.createRange();
                range.setStart(targetNode, 0);
                range.collapse(true);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    });
    // --- END NEW LOGIC ---

    // Track selection to restore position after choosing a file
    let lastSelection = null;
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let node = selection.anchorNode;
            while (node) {
                if (node === editorCanvas) {
                    lastSelection = selection.getRangeAt(0).cloneRange();
                    break;
                }
                node = node.parentNode;
            }
        }
    });

    // Basic Formatting Commands
    toolBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const command = btn.getAttribute('data-command');

            if (command === 'createLink') {
                const url = prompt('Introduce la URL del enlace:', 'http://');
                if (url) {
                    document.execCommand(command, false, url);
                }
            } else if (['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(command)) {
                // Special handling for centering images which are inline-blocks
                let selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    let node = selection.anchorNode;
                    // Find if we are inside an image wrapper
                    let imgWrapper = null;
                    while (node && node !== editorCanvas) {
                        if (node.nodeType === 1 && node.classList.contains('image-resizer-wrapper')) {
                            imgWrapper = node;
                            break;
                        }
                        node = node.parentNode;
                    }

                    if (imgWrapper) {
                        // We are aligning an image
                        imgWrapper.classList.remove('align-left', 'align-center', 'align-right', 'align-full');

                        if (command === 'justifyLeft') imgWrapper.classList.add('align-left');
                        if (command === 'justifyCenter') imgWrapper.classList.add('align-center');
                        if (command === 'justifyRight') imgWrapper.classList.add('align-right');
                        if (command === 'justifyFull') imgWrapper.classList.add('align-full');
                    } else {
                        // Normal text alignment
                        document.execCommand(command, false, null);
                    }
                } else {
                    document.execCommand(command, false, null);
                }
            } else if (command) {
                document.execCommand(command, false, null);
            }
            editorCanvas.focus();
        });
    });

    // Mark/Highlight Text
    markBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        // Tries to safely surround within the exact selection
        const mark = document.createElement('mark');
        try {
            range.surroundContents(mark);
        } catch (err) {
            // Document.execCommand fallback for bold/italic is better for complex selections
            // We'll wrap manually instead if it's plain text crossing boundaries
            const text = range.extractContents();
            mark.appendChild(text);
            range.insertNode(mark);
        }
    });

    // Semantic Formatting (H1, H2, p)
    formatSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (!value) return;

        // Si el usuario selecciona "Párrafo Normal", limpiamos estrictamente 
        // cualquier estilo importado (como al copiar y pegar de otra web)
        if (value === 'p') {
            document.execCommand('removeFormat', false, null);
        }

        document.execCommand('formatBlock', false, value);
        e.target.value = '';
        editorCanvas.focus();
    });

    // Clean Workspace
    clearBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres limpiar todo el contenido? (No se puede deshacer)')) {
            editorCanvas.innerHTML = '<h1>🎓 Título del Módulo</h1><p><br></p>';
        }
    });

    // Image Upload Handling
    imageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            // Wrap in a resizable, inline-block span so it can be dragged and resized freely. 
            // Setting contenteditable="false" forces the browser to treat it as a solid draggable block.
            const imgHTML = `&nbsp;<span class="image-resizer-wrapper align-center" contenteditable="false"><img src="${base64Data}" class="styled-image" alt="Imagen del curso"><span class="custom-resizer" title="Haz clic y arrastra para cambiar tamaño" contenteditable="false"></span></span>&nbsp;`;

            editorCanvas.focus();
            if (lastSelection) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(lastSelection);
            }
            document.execCommand('insertHTML', false, imgHTML);
        };
        reader.readAsDataURL(file);

        // Reset so same file can be chosen again
        e.target.value = '';
    });

    // Video Embed Handling
    if (videoBtn) {
        videoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = prompt("Introduce la URL del vídeo (YouTube, Vimeo o un archivo mp4 directo):");
            if (url) {
                let embedUrl = url;

                if (url.includes('youtube.com/watch?v=')) {
                    const videoId = url.split('v=')[1].split('&')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
                } else if (url.includes('youtu.be/')) {
                    const videoId = url.split('youtu.be/')[1].split('?')[0];
                    embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
                } else if (url.includes('vimeo.com/')) {
                    const videoId = url.split('vimeo.com/')[1].split('?')[0];
                    embedUrl = `https://player.vimeo.com/video/${videoId}`;
                }

                const isVideoTag = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.webm');

                let mediaElement = '';
                if (isVideoTag) {
                    mediaElement = `<video src="${embedUrl}" class="styled-video" controls style="width: 100%; height: auto; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); display: block;" controlsList="nodownload"></video>`;
                } else {
                    // pointer-events: auto so it can be clicked, but we rely on a wrapper overlay for resizing edge interaction
                    mediaElement = `<iframe src="${embedUrl}" class="styled-video" style="width: 100%; aspect-ratio: 16/9; border: none; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); display: block; pointer-events: auto;" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
                }

                // Add align-center string by default
                const vidHTML = `&nbsp;<span class="image-resizer-wrapper align-center" contenteditable="false" style="width: 60%;">${mediaElement}<span class="custom-resizer" title="Haz clic y arrastra para cambiar tamaño" contenteditable="false"></span></span>&nbsp;`;

                editorCanvas.focus();
                document.execCommand('insertHTML', false, vidHTML);
            }
        });
    }

    // Image Resize Drag Logic for custom visible handle
    document.addEventListener('mousedown', (e) => {
        if (e.target && e.target.classList.contains('custom-resizer')) {
            e.preventDefault(); // Prevent text selection
            const resizer = e.target;
            const wrapper = resizer.parentElement;
            const startX = e.clientX;
            const startWidth = wrapper.offsetWidth;

            const onMouseMove = (moveEvent) => {
                const newWidth = Math.max(100, startWidth + (moveEvent.clientX - startX));
                wrapper.style.width = newWidth + 'px';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    });

    // Toggle HTML Source Mode
    htmlSourceBtn.addEventListener('click', () => {
        isSourceMode = !isSourceMode;

        if (isSourceMode) {
            // Turning on Source Mode
            const currentHTML = editorCanvas.innerHTML;

            // Format HTML roughly (simple regex approach to add newlines for readability)
            let formattedHTML = currentHTML.replace(/></g, '>\n<');

            htmlSourceEditor.value = formattedHTML;

            editorCanvas.style.display = 'none';
            htmlSourceEditor.style.display = 'block';
            htmlSourceBtn.classList.add('active');

            // Disable other buttons
            toolBtns.forEach(btn => btn.disabled = true);
            insertSelect.disabled = true;
            formatSelect.disabled = true;
            insertBtn.disabled = true;
            clearBtn.disabled = true;
        } else {
            // Turning off Source Mode
            editorCanvas.innerHTML = htmlSourceEditor.value;

            htmlSourceEditor.style.display = 'none';
            editorCanvas.style.display = 'block';
            htmlSourceBtn.classList.remove('active');

            // Re-enable other buttons
            toolBtns.forEach(btn => btn.disabled = false);
            insertSelect.disabled = false;
            formatSelect.disabled = false;
            insertBtn.disabled = false;
            clearBtn.disabled = false;

            // Re-render mindmaps
            setTimeout(() => window.renderMindmaps(editorCanvas), 50);
        }
    });

    // Image Zoom functionality for within the editor
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('styled-image') && e.target.tagName === 'IMG') {
            const imgSrc = e.target.src;

            // Create modal if it doesn't exist
            let modal = document.getElementById('editor-img-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'editor-img-modal';
                modal.className = 'image-zoom-modal';
                modal.innerHTML = `
                    <span class="image-zoom-close">&times;</span>
                    <img class="image-zoom-content" id="editor-img-zoomed">
                `;
                document.body.appendChild(modal);

                modal.querySelector('.image-zoom-close').addEventListener('click', () => {
                    modal.classList.remove('active');
                    setTimeout(() => modal.style.display = 'none', 300);
                });

                modal.addEventListener('click', (ev) => {
                    if (ev.target === modal) {
                        modal.classList.remove('active');
                        setTimeout(() => modal.style.display = 'none', 300);
                    }
                });
            }

            const zoomedImg = document.getElementById('editor-img-zoomed');
            zoomedImg.src = imgSrc;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10); // Small delay to allow display flex to apply before opacity transition
        }
    });

    // Template HTML structure for Download/Export
    const getTemplateHTML = (content) => `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recurso de Plantilla Moodle</title>
    <!-- Markmap -->
    <script src="https://d3js.org/d3.v6.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.2.0"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        :root {
            --text-color: #40464f;
            --primary-color: #93b9ff;
            --secondary-color: #82a8ec;
            --bg-color: #fcfbfa;
            --side-bar-bg-color: var(--bg-color);
            --marker-color: #93b9ff;
            --highlight-color: #ffffb5c2;
            --header-span-color: var(--primary-color);
            --block-bg-color: #cdffd8;
            --img-shadow-color: rgba(64, 70, 79, 0.08);
            --heading-bgcolor: unset;
            --preformatted-text-bgcolor: #f1f5f9;
            --link-color: #3b82f6;
            --container-width: min(90%, 1200px);
            --heading-padding: 18px 25px;
            --content-margin: clamp(15px, 4%, 40px);
            --border-radius-lg: 16px;
            --border-radius-md: 10px;
            --transition-speed: 0.3s;
            --shadow-sm: 0 4px 6px -1px var(--img-shadow-color), 0 2px 4px -1px var(--img-shadow-color);
            --shadow-md: 0 10px 15px -3px var(--img-shadow-color), 0 4px 6px -2px var(--img-shadow-color);
            --shadow-hover: 0 20px 25px -5px var(--img-shadow-color), 0 10px 10px -5px var(--img-shadow-color);
        }

        body {
            color: var(--text-color);
            background-color: var(--bg-color);
            font-family: 'Outfit', 'Segoe UI', system-ui, sans-serif;
            line-height: 1.7;
            text-align: left;
            counter-reset: h2counter;
            margin: 0 auto;
            padding: 40px 15px;
            box-sizing: border-box;
            max-width: 1000px;
            background-image: radial-gradient(circle at 100% 0%, #f0f7ff 0%, transparent 25%),
                radial-gradient(circle at 0% 100%, #effff3 0%, transparent 25%);
            background-attachment: fixed;
        }

        /* Animación de entrada */
        .fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        @keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }

        h1, h2, h3, h4, h5, h6 { color: var(--text-color); padding: 0; margin-left: 0; box-sizing: border-box; width: 100%; font-weight: 700; letter-spacing: -0.02em; }
        h1 { background: linear-gradient(135deg, #cdffd8 0%, #93b9ff 100%); padding: var(--heading-padding); margin: 0 0 2.5rem 0; font-size: clamp(2rem, 5vw, 2.5rem); border-radius: var(--border-radius-lg); box-shadow: var(--shadow-sm); color: #2c3138; font-weight: 800; display: flex; align-items: center; gap: 15px; }
        h2 { background: linear-gradient(135deg, rgba(205, 255, 216, 0.6) 0%, rgba(147, 185, 255, 0.6) 100%); padding: var(--heading-padding); border-radius: var(--border-radius-md); margin: 3rem 0 1.5rem 0; font-size: clamp(1.4rem, 4vw, 1.8rem); counter-reset: h3counter; border-left: 5px solid var(--primary-color); color: #2c3138; transition: transform var(--transition-speed); }
        h2:hover { transform: translateX(5px); }
        h3 { color: var(--secondary-color); margin: 2em 0 1em 0; font-size: clamp(1.2rem, 3.5vw, 1.5rem); counter-reset: h4counter; padding-left: 15px; border-left: 3px solid var(--block-bg-color); }
        h4 { color: var(--text-color); margin: 1.5em 0 0.8em 0; font-size: clamp(1.1rem, 3vw, 1.3rem); counter-reset: h5counter; opacity: 0.9; font-weight: 600; }
        h2:before { counter-increment: h2counter; content: counter(h2counter) ".\\0000a0\\0000a0"; color: var(--primary-color); font-weight: 900; }
        h3:before { counter-increment: h3counter; content: counter(h2counter) "." counter(h3counter) ".\\0000a0\\0000a0"; color: var(--primary-color); opacity: 0.7; }

        a { color: var(--link-color); text-decoration: none; position: relative; font-weight: 500; transition: color 0.2s ease; }
        p a::after, li a::after { content: ''; position: absolute; width: 100%; transform: scaleX(0); height: 2px; bottom: -2px; left: 0; background-color: var(--link-color); transform-origin: bottom right; transition: transform 0.3s cubic-bezier(0.86, 0, 0.07, 1); }
        p a:hover::after, li a:hover::after { transform: scaleX(1); transform-origin: bottom left; }
        p a:hover, li a:hover { color: #1d4ed8; }

        code { color: #db2777; font-size: 0.9em; padding: 3px 6px; border-radius: 6px; background-color: #fce7f3; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-weight: 500; }
        pre { background-color: #1e293b; color: #f8fafc; padding: 1.5rem; border-radius: var(--border-radius-lg); margin: 2rem 0; line-height: 1.6; overflow-x: auto; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3); position: relative; }
        pre code { background-color: transparent; color: inherit; padding: 0; font-size: 0.95em; }
        pre::before { content: "Código"; position: absolute; top: 0; right: 0; background: #cbd5e1; color: #0f172a; font-size: 0.7rem; padding: 4px 10px; border-bottom-left-radius: 8px; border-top-right-radius: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }

        ul, ol { margin: 1.5rem 0 1.5rem var(--content-margin); padding-left: 10px; }
        li { margin: 0.6rem 0; padding-left: 10px; position: relative; }
        ul { list-style-type: none; }
        ul>li::before { content: "✦"; color: var(--primary-color); position: absolute; left: -15px; top: 1px; font-size: 1.1em; transition: transform 0.2s; }
        ul>li:hover::before { transform: scale(1.2) rotate(15deg); }
        ol { list-style-type: none; counter-reset: custom-counter; }
        ol>li { counter-increment: custom-counter; }
        ol>li::before { content: counter(custom-counter); color: white; background: var(--primary-color); position: absolute; left: -28px; top: 4px; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; box-shadow: 0 2px 4px rgba(147, 185, 255, 0.4); }

        p { margin-bottom: 1.2rem; font-size: 1.05rem; }
        mark { background: linear-gradient(120deg, var(--highlight-color) 0%, var(--highlight-color) 100%); background-repeat: no-repeat; background-size: 100% 40%; background-position: 0 88%; padding: 2px 4px; border-radius: 3px; color: inherit; font-weight: 500; }
        
        blockquote { position: relative; padding: 1.5rem 2rem 1.5rem 3rem; margin: 2.5rem 0; background: white; border: none; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-sm); font-size: 1.1rem; font-style: italic; color: #475569; transition: transform var(--transition-speed), box-shadow var(--transition-speed); }
        blockquote::before { content: "❝"; position: absolute; left: 15px; top: -10px; font-size: 4rem; color: var(--primary-color); opacity: 0.2; line-height: 1; }
        blockquote:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
        hr { margin: 3rem 0; border: 0; height: 3px; background: linear-gradient(to right, transparent, var(--block-bg-color), var(--primary-color), transparent); opacity: 0.5; }

        .table-container { overflow-x: auto; margin: 2rem 0; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-sm); }
        table { width: 100%; border-collapse: collapse; background: white; text-align: left; }
        th { background: #f8fafc; color: #334155; font-weight: 700; padding: 16px; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; border-bottom: 2px solid var(--primary-color); }
        td { padding: 16px; border-bottom: 1px solid #e2e8f0; color: #475569; }
        tr:last-child td { border-bottom: none; }
        tbody tr { transition: background-color 0.2s ease, transform 0.2s ease; }
        tbody tr:hover { background-color: #f1f5f9; transform: scale(1.01); position: relative; z-index: 10; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); }

        [class^="b-"] { display: flex; flex-direction: column; margin: 2rem 0; padding: 20px 25px 20px 60px; border-radius: var(--border-radius-md); position: relative; box-shadow: var(--shadow-sm); transition: all var(--transition-speed); overflow: hidden; border: none; }
        [class^="b-"]::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
        [class^="b-"]::after { position: absolute; left: 20px; top: 22px; font-size: 1.5rem; line-height: 1; }
        [class^="b-"]:hover { transform: translateY(-5px); box-shadow: var(--shadow-md); }
        [class^="b-"] strong { display: block; margin-bottom: 5px; font-size: 1.1rem; }
        
        .b-gray { background-color: #f1f5f9; color: #334155; } .b-gray::before { background-color: #94a3b8; } .b-gray::after { content: "📝"; }
        .b-green { background-color: #ecfdf5; color: #065f46; } .b-green::before { background-color: #10b981; } .b-green::after { content: "✅"; }
        .b-red { background-color: #fef2f2; color: #991b1b; } .b-red::before { background-color: #ef4444; } .b-red::after { content: "⚠️"; }
        .b-blue { background-color: #eff6ff; color: #1e3a8a; } .b-blue::before { background-color: #3b82f6; } .b-blue::after { content: "💡"; }
        .b-orange { background-color: #fff7ed; color: #9a3412; } .b-orange::before { background-color: #f97316; } .b-orange::after { content: "🔥"; }
        .b-purple { background-color: #faf5ff; color: #6b21a8; } .b-purple::before { background-color: #a855f7; } .b-purple::after { content: "🤔"; }
        .b-pink { background-color: #fdf2f8; color: #831843; } .b-pink::before { background-color: #ec4899; } .b-pink::after { content: "✨"; }
        .b-cefire { background: linear-gradient(135deg, rgba(205, 255, 216, 0.3) 0%, rgba(147, 185, 255, 0.3) 100%); color: #1e293b; } .b-cefire::before { background: linear-gradient(to bottom, #cdffd8, #93b9ff); } .b-cefire::after { content: "🎓"; }

        details { background: white; border-radius: var(--border-radius-md); box-shadow: var(--shadow-sm); margin: 2rem 0; overflow: hidden; transition: all 0.3s ease; border: 1px solid #e2e8f0; }
        details[open] { box-shadow: var(--shadow-md); border-color: var(--primary-color); }
        summary { padding: 18px 25px; font-weight: 600; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; color: #1e293b; transition: background 0.2s ease; }
        summary::-webkit-details-marker { display: none; }
        summary::after { content: "+"; font-size: 1.5rem; font-weight: 300; color: var(--primary-color); transition: transform 0.3s ease; }
        details[open] summary { background: white; border-bottom: 1px solid #f1f5f9; }
        details[open] summary::after { transform: rotate(45deg); color: #ef4444; }
        .details-content { padding: 20px 25px; animation: slideDown 0.3s ease-out; color: #475569; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 2.5rem 0; }
        .concept-card { background: white; padding: 25px; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-sm); border-top: 4px solid var(--primary-color); transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); position: relative; overflow: hidden; }
        .concept-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(205, 255, 216, 0.1) 0%, rgba(147, 185, 255, 0.1) 100%); opacity: 0; transition: opacity 0.3s ease; z-index: 0; }
        .concept-card:hover { transform: translateY(-10px); box-shadow: var(--shadow-hover); }
        .concept-card:hover::before { opacity: 1; }
        .concept-card > * { position: relative; z-index: 1; }
        .concept-card h4 { margin-top: 0; color: var(--primary-color); font-size: 1.3rem; display: flex; align-items: center; gap: 10px; }
        .concept-card p { margin-bottom: 0; font-size: 0.95rem; color: #64748b; }

        .tabs { display: flex; flex-wrap: wrap; margin: 2.5rem 0; background: white; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; }
        .tabs input[type="radio"] { display: none; }
        .tabs label { padding: 15px 25px; font-weight: 600; cursor: pointer; background: #f1f5f9; color: #64748b; flex: 1; text-align: center; transition: all 0.3s ease; border-bottom: 3px solid transparent; }
        .tabs label:hover { background: #e2e8f0; color: #334155; }
        .tab-content { width: 100%; padding: 25px; display: none; background: white; color: #475569; animation: fadeIn 0.4s ease; }
        
        /* Match specific tab input to its corresponding label using generic structural selectors */
        .tabs input[type="radio"]:nth-of-type(1):checked ~ label:nth-of-type(1),
        .tabs input[type="radio"]:nth-of-type(2):checked ~ label:nth-of-type(2),
        .tabs input[type="radio"]:nth-of-type(3):checked ~ label:nth-of-type(3) { 
            background: white; color: var(--primary-color); border-bottom: 3px solid var(--primary-color); 
        }
        
        /* Match specific tab input to its corresponding content relying strictly on order */
        .tabs input[type="radio"]:focus { outline: none; }
        .tabs input[type="radio"]:nth-of-type(1):checked ~ .tab-content:nth-of-type(1),
        .tabs input[type="radio"]:nth-of-type(2):checked ~ .tab-content:nth-of-type(2),
        .tabs input[type="radio"]:nth-of-type(3):checked ~ .tab-content:nth-of-type(3) { 
            display: block; 
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .btn-action { display: inline-flex; align-items: center; justify-content: center; padding: 12px 28px; background: linear-gradient(135deg, #93b9ff 0%, #82a8ec 100%); color: white; font-weight: 600; border-radius: 30px; text-decoration: none; box-shadow: 0 4px 15px rgba(147, 185, 255, 0.4); margin: 1rem 0; border: none; cursor: pointer; }
        .btn-action:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 6px 20px rgba(147, 185, 255, 0.6); color: white; }
        .btn-action:hover::after { display: none; }
        .btn-action svg { margin-left: 8px; transition: transform 0.3s ease; }
        .btn-action:hover svg { transform: translateX(5px); }

        @media (max-width: 768px) {
            body { padding: 20px 15px; }
            .cards-grid { grid-template-columns: 1fr; }
            .tabs label { flex-basis: 100%; border-bottom: 1px solid #cbd5e1; }
            .tabs input[type="radio"]:nth-of-type(1):checked ~ label:nth-of-type(1),
            .tabs input[type="radio"]:nth-of-type(2):checked ~ label:nth-of-type(2),
            .tabs input[type="radio"]:nth-of-type(3):checked ~ label:nth-of-type(3) { 
                border-bottom-color: transparent; border-left: 4px solid var(--primary-color); 
            }
        }

        /* Image Styling */
        .image-resizer-wrapper { display: inline-block; position: relative; width: 60%; min-width: 150px; max-width: 100%; margin: 10px; vertical-align: top; }
        .image-resizer-wrapper img.styled-image { width: 100%; height: auto; display: block; cursor: zoom-in; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-md); transition: transform var(--transition-speed), box-shadow var(--transition-speed); }
        .image-resizer-wrapper img.styled-image:hover { transform: scale(1.02); box-shadow: var(--shadow-hover); }
        .custom-resizer { display: none !important; }
        
        /* Image Alignment */
        .image-resizer-wrapper.align-left { display: block; margin-left: 0; margin-right: auto; }
        .image-resizer-wrapper.align-center { display: block; margin-left: auto; margin-right: auto; }
        .image-resizer-wrapper.align-right { display: block; margin-left: auto; margin-right: 0; }
        
        /* Mindmap Styling */
        .mindmap-wrapper { position: relative; width: 100%; margin: 2.5rem 0; border-radius: var(--border-radius-lg); box-shadow: var(--shadow-sm); background: white; overflow: visible; border: 1px solid #e2e8f0; user-select: none; -webkit-user-select: none; }
        .mindmap { display: block; width: 100%; height: 400px; pointer-events: auto; overflow: visible; }
        .mindmap-edit-btn { position: absolute; top: 15px; right: 15px; z-index: 10; background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-size: 0.9rem; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
        .mindmap-center-btn { position: absolute; bottom: 15px; right: 15px; z-index: 10; background: white; border: 1px solid #cbd5e1; color: #475569; padding: 10px; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); transition: all 0.2s; display: flex; align-items: center; justify-content: center; opacity: 0.7; }
        .mindmap-center-btn:hover { background: #f8fafc; color: var(--primary-color); border-color: var(--primary-color); opacity: 1; transform: scale(1.05); }
        .mindmap-edit-btn:hover { background: #f8fafc; color: var(--primary-color); border-color: var(--primary-color); }
        .mindmap-add-btn { fill: #f1f5f9; stroke: #cbd5e1; stroke-width: 1px; transition: all 0.2s ease; }
        .mindmap-add-btn-group:hover .mindmap-add-btn { fill: var(--primary-color); stroke: var(--primary-color); }
        .mindmap-add-icon { fill: #64748b; font-size: 14px; font-weight: bold; font-family: monospace; }
        .mindmap-add-btn-group:hover .mindmap-add-icon { fill: white; }
        g.markmap-node text { cursor: pointer; pointer-events: all; }
        g.markmap-node text:hover { fill: var(--primary-color) !important; }
        .mindmap-add-btn-group { pointer-events: all; }

        /* Modal for Image Zoom */
        .image-zoom-modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(15, 23, 42, 0.9); justify-content: center; align-items: center; opacity: 0; transition: opacity 0.3s ease; }
        .image-zoom-modal.active { display: flex; opacity: 1; }
        .image-zoom-content { max-width: 90%; max-height: 90%; border-radius: var(--border-radius-lg); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .image-zoom-modal.active .image-zoom-content { transform: scale(1); }
        .image-zoom-close { position: absolute; top: 20px; right: 30px; color: #f8fafc; font-size: 40px; font-weight: bold; cursor: pointer; transition: color 0.2s; }
        .image-zoom-close:hover { color: #93b9ff; }
        .anchor-point { 
            display: inline-block;
            height: 0;
            width: 0;
            overflow: hidden;
            visibility: hidden;
            pointer-events: none;
            scroll-margin-top: 100px; /* Space for the header if needed */
        }
    </style>
</head>
<body>
    <div class="fade-in-up">
        ${content}
    </div>

    <!-- Image Modal Structure -->
    <div id="moodle-img-modal" class="image-zoom-modal">
        <span class="image-zoom-close">&times;</span>
        <img class="image-zoom-content" id="moodle-img-zoomed">
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const modal = document.getElementById('moodle-img-modal');
            const zoomedImg = document.getElementById('moodle-img-zoomed');
            const closeBtn = document.querySelector('.image-zoom-close');

            document.querySelectorAll('img.styled-image').forEach(img => {
                img.addEventListener('click', function() {
                    zoomedImg.src = this.src;
                    modal.style.display = 'flex';
                    setTimeout(() => modal.classList.add('active'), 10);
                });
            });

            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    setTimeout(() => modal.style.display = 'none', 300);
                }
            });

            // Initialize Mindmaps
            if (typeof window.markmap !== 'undefined') {
                const { Markmap } = window.markmap;
                document.querySelectorAll('.mindmap-wrapper').forEach(wrapper => {
                    const svg = wrapper.querySelector('svg.mindmap');
                    const dataScript = wrapper.querySelector('.markmap-data');
                    if (svg && dataScript) {
                        try {
                            const data = JSON.parse(dataScript.textContent);
                            const mm = Markmap.create(svg, { autoFit: true, initialExpandLevel: 2 }, data);
                            
                            const centerBtn = wrapper.querySelector('.mindmap-center-btn');
                            if (centerBtn) {
                                centerBtn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    mm.fit();
                                });
                            }
                        } catch (e) {
                            console.error("Error parsing markmap data", e);
                        }
                    }
                });
            }
        });
    </script>
</body>
</html>`;

    // Dropdown toggling logic
    downloadDropdownBtn.addEventListener('click', (e) => {
        downloadMenu.classList.toggle('show');
        e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
        if (!downloadDropdownBtn.contains(e.target)) {
            downloadMenu.classList.remove('show');
        }
    });

    // Export HTML Generation
    exportHtmlBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // Remove selection to avoid messing html
        window.getSelection().removeAllRanges();

        // Remove custom resizers from output HTML
        const tempCanvas = editorCanvas.cloneNode(true);
        tempCanvas.querySelectorAll('.custom-resizer').forEach(el => el.remove());
        tempCanvas.querySelectorAll('.mindmap-edit-btn').forEach(el => el.remove());
        tempCanvas.querySelectorAll('.mindmap-text-editor').forEach(el => el.remove());

        // Clear SVG drawn paths so the initialization script renders them cleanly once
        tempCanvas.querySelectorAll('svg.mindmap').forEach(svg => svg.innerHTML = '');

        // Ensure all accordions (details) are closed in the export
        tempCanvas.querySelectorAll('details').forEach(details => details.removeAttribute('open'));

        // Generate Index if placeholder exists
        const tocHTML = generateTOC(tempCanvas);
        tempCanvas.querySelectorAll('.index-placeholder').forEach(placeholder => {
            placeholder.outerHTML = tocHTML;
        });

        // Obtenemos el contenido
        let innerHTML = tempCanvas.innerHTML;

        // Convert [#anchor] or [ #anchor ] to <span id="anchor" class="anchor-point"></span>
        innerHTML = innerHTML.replace(/\[\s*#\s*([^\]\s]+)\s*\]/g, '<span id="$1" class="anchor-point"></span>');

        const htmlContent = getTemplateHTML(innerHTML);

        // Creamos y descargamos el archivo
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modulo-moodle.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        downloadMenu.classList.remove('show');
    });

    // Export Markdown Generation
    exportMdBtn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadMenu.classList.remove('show');

        // Apply a class to hide interactive WYSIWYG elements (resizers/placeholders)
        const tempCanvas = editorCanvas.cloneNode(true);
        tempCanvas.querySelectorAll('.custom-resizer').forEach(el => el.remove());
        tempCanvas.querySelectorAll('.mindmap-edit-btn').forEach(el => el.remove());
        tempCanvas.querySelectorAll('.mindmap-text-editor').forEach(el => el.remove());

        // Ensure all accordions (details) are closed in the export
        tempCanvas.querySelectorAll('details').forEach(details => details.removeAttribute('open'));

        // Generate Index if placeholder exists
        const tocHTML = generateTOC(tempCanvas);
        tempCanvas.querySelectorAll('.index-placeholder').forEach(placeholder => {
            placeholder.outerHTML = tocHTML;
        });

        // Remove empty placeholders
        tempCanvas.querySelectorAll('[contenteditable="false"]').forEach(el => el.removeAttribute('contenteditable'));

        // Initialize Turndown
        const turndownService = new TurndownService({
            headingStyle: 'atx',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced'
        });

        // Keep complex components as raw HTML to ensure they work in Moodle/Google Docs
        turndownService.keep(['div', 'span', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);

        let innerHTML = tempCanvas.innerHTML;
        // Also convert for Markdown export
        innerHTML = innerHTML.replace(/\[\s*#\s*([^\]\s]+)\s*\]/g, '<span id="$1" class="anchor-point"></span>');

        const markdownContent = turndownService.turndown(innerHTML);

        // Download Markdown File
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modulo-moodle.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Patterns for component insertion
    const blockTemplates = {
        'callout-blue': `<div class="b-blue"><strong>Concepto Clave</strong><p>Escribe tu concepto aquí...</p></div><p><br></p>`,
        'callout-green': `<div class="b-green"><strong>Buena Práctica</strong><p>Escribe tu recomendación aquí...</p></div><p><br></p>`,
        'callout-red': `<div class="b-red"><strong>Atención</strong><p>Escribe tu advertencia aquí...</p></div><p><br></p>`,
        'callout-orange': `<div class="b-orange"><strong>Importante</strong><p>Escribe tu nota importante aquí...</p></div><p><br></p>`,
        'callout-gray': `<div class="b-gray"><strong>Nota</strong><p>Escribe tu nota aquí...</p></div><p><br></p>`,
        'callout-purple': `<div class="b-purple"><strong>Para Reflexionar</strong><p>Escribe tu reflexión aquí...</p></div><p><br></p>`,
        'callout-pink': `<div class="b-pink"><strong>Curiosidad</strong><p>Escribe tu curiosidad aquí...</p></div><p><br></p>`,
        'callout-cefire': `<div class="b-cefire"><strong>Aviso Institucional</strong><p>Escribe tu aviso aquí...</p></div><p><br></p>`,
        'details': `<details><summary>Haz clic para desplegar / contraer</summary><div class="details-content"><p>Contenido interno del desplegable...</p></div></details><p><br></p>`,
        'cards': `
        <div class="cards-grid">
            <div class="concept-card"><h4>🎯 Título 1</h4><p>Descripción breve aquí...</p></div>
            <div class="concept-card"><h4>🧠 Título 2</h4><p>Descripción breve aquí...</p></div>
            <div class="concept-card"><h4>📊 Título 3</h4><p>Descripción breve aquí...</p></div>
        </div><p><br></p>`,
        'table': `
        <div class="table-container">
            <table>
                <thead>
                    <tr><th>Columna A</th><th>Columna B</th></tr>
                </thead>
                <tbody>
                    <tr><td>Dato 1</td><td>Dato 2</td></tr>
                    <tr><td>Dato 3</td><td>Dato 4</td></tr>
                </tbody>
            </table>
        </div><p><br></p>`,
        'tabs': () => {
            const id = Math.random().toString(36).substr(2, 9);
            return `
        <div class="tabs">
            <input type="radio" name="tabs-${id}" id="tab1-${id}" checked>
            <label for="tab1-${id}" id="label-tab1-${id}">Pestaña 1</label>
            <input type="radio" name="tabs-${id}" id="tab2-${id}">
            <label for="tab2-${id}" id="label-tab2-${id}">Pestaña 2</label>
            <input type="radio" name="tabs-${id}" id="tab3-${id}">
            <label for="tab3-${id}" id="label-tab3-${id}">Pestaña 3</label>
            <div class="tab-content" id="content-tab1-${id}"><h4>Contenido 1</h4><p>Texto de la primera pestaña...</p></div>
            <div class="tab-content" id="content-tab2-${id}"><h4>Contenido 2</h4><p>Texto de la segunda pestaña...</p></div>
            <div class="tab-content" id="content-tab3-${id}"><h4>Contenido 3</h4><p>Texto de la tercera pestaña...</p></div>
        </div><p><br></p>`;
        },
        'code': `<pre><code>// Escribe tu código aquí...</code></pre><p><br></p>`,
        'divider': `<hr><p><br></p>`,
        'button': `<a href="#" class="btn-action">Botón de Acción<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></a><p><br></p>`,
        'mindmap': () => {
            const id = 'mindmap-' + Math.random().toString(36).substr(2, 9);
            return `
        <div class="mindmap-wrapper" contenteditable="false">
            <button class="mindmap-edit-btn" contenteditable="false"><i class="fas fa-edit"></i> Editar Mapa Mental</button>
            <button class="mindmap-center-btn" contenteditable="false" title="Centrar Mapa">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <svg id="${id}" class="mindmap"></svg>
            <pre class="markmap-data" style="display: none;">
                {
                    "t": "root", "d": 0, "v": "Concepto Principal",
                    "c": [
                        { "t": "heading", "d": 1, "v": "Idea 1", "c": [
                            { "t": "heading", "d": 2, "v": "Detalle A" },
                            { "t": "heading", "d": 2, "v": "Detalle B" }
                        ]},
                        { "t": "heading", "d": 1, "v": "Idea 2", "c": [
                            { "t": "heading", "d": 2, "v": "Detalle 2A" },
                            { "t": "heading", "d": 2, "v": "Detalle 2B" }
                        ]}
                    ]
                }
            </pre>
        </div><p><br></p>`;
        },
        'index': `<div class="index-placeholder" contenteditable="false">
            <div class="index-header">Índice de Contenidos</div>
            <div class="index-body">Este espacio se convertirá automáticamente en un índice con hipervínculos al exportar.</div>
        </div><p><br></p>`
    };

    const insertElement = () => {
        const value = insertSelect.value;
        if (!value) return;

        let template = blockTemplates[value];
        if (!template) return;

        if (typeof template === 'function') {
            template = template();
        }

        editorCanvas.focus();
        document.execCommand('insertHTML', false, template);

        if (value === 'mindmap') {
            setTimeout(() => window.renderMindmaps(editorCanvas), 50);
        }

        insertSelect.value = '';
    };

    // TOC / Index Generator
    const generateTOC = (container) => {
        const headers = container.querySelectorAll('h1, h2, h3, h4');
        if (headers.length === 0) return '<p><i>No se han encontrado títulos (T1-T4) para generar el índice.</i></p>';

        let tocHTML = '<div class="moodle-index"><ul>';

        headers.forEach((header, index) => {
            // Generate ID if missing
            if (!header.id || header.id.startsWith('toc-')) {
                const slug = header.textContent.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .substring(0, 50);
                header.id = `toc-${slug}-${index}`;
            }

            const level = header.tagName.toLowerCase();
            const text = header.textContent.trim();
            tocHTML += `<li class="moodle-index-item moodle-index-${level}"><a href="#${header.id}">${text}</a></li>`;
        });

        tocHTML += '</ul></div>';
        return tocHTML;
    };

    insertBtn.addEventListener('click', insertElement);
    insertSelect.addEventListener('change', insertElement);
});
