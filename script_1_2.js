
// script.js - Complete Frontend Script

const SERVER_URL = 'http://localhost:8000/api/image/stability'; // Updated to match backend port

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selections ---
    const modeRadios = document.querySelectorAll('input[name="generation-mode"]');
    const imageUploadInput = document.getElementById('image-upload');
    const uploadTriggerButton = document.getElementById('upload-trigger-button');
    const chatImagePreviewContainer = document.getElementById('chat-image-preview-container');
    const chatImagePreview = document.getElementById('chat-image-preview');
    const uploadStatusMessage = document.getElementById('upload-status');
    const removeImageButton = document.getElementById('remove-image-button');

    const submitButton = document.querySelector('.submit-button');
    const promptTextarea = document.getElementById('prompt'); // Get prompt textarea directly
    const outputArea = document.querySelector('.output-area');
    const outputPlaceholder = outputArea.querySelector('.placeholder');
    const outputLoadingIndicator = outputArea.querySelector('.loading-indicator');
    const outputImageGrid = outputArea.querySelector('.image-grid');

    // Sidebar elements for potential disabling
    const sidebarControls = document.querySelectorAll('.sidebar select, .sidebar input, .sidebar textarea, .sidebar button:not(.settings-button)'); // Select controls to disable

    const formElements = {
        mode: () => document.querySelector('input[name="generation-mode"]:checked').value,
        aiModel: document.getElementById('ai-model'),
        prompt: promptTextarea, // Use direct reference
        negativePrompt: document.getElementById('negative-prompt'),
        aspectRatio: document.getElementById('aspect-ratio'),
        seed: document.getElementById('seed'),
        outputFormat: document.getElementById('output-format'),
        uploadedImageFile: null
    };

    let isGenerating = false; // State variable for loading

    // --- Mode Switching Logic ---
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            const isImg2Img = event.target.value === 'img2img';
            uploadTriggerButton.disabled = !isImg2Img;
            if (!isImg2Img) {
                clearImageUpload();
            }
            updatePlaceholderText(); // Update placeholder based on mode/image
        });
    });

    // --- Paperclip Button Logic ---
    uploadTriggerButton.addEventListener('click', () => {
        if (!uploadTriggerButton.disabled) {
            imageUploadInput.click();
        }
    });

    // --- Image Upload Handling & Validation ---
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        clearImageUpload(); // Clear previous state

        if (!file) { return; }
        if (!file.type.startsWith('image/')) {
            displayUploadStatus('Invalid file type (try PNG, JPG, WEBP).', true);
            event.target.value = null;
            return;
        }

        formElements.uploadedImageFile = file;
        uploadTriggerButton.classList.add('has-image');

        const reader = new FileReader();
        reader.onload = (e) => {
            chatImagePreview.src = e.target.result;
            displayUploadStatus(file.name);
            chatImagePreviewContainer.style.display = 'flex';
            updatePlaceholderText(); // Update placeholder now that image is attached
        }
        reader.onerror = () => {
            displayUploadStatus('Error reading file.', true);
            clearImageUpload();
        };
        reader.readAsDataURL(file);
        console.log("Image selected:", file.name, file.type);
    });

    // --- Remove Image Button Logic ---
    removeImageButton.addEventListener('click', clearImageUpload);

    // --- Helper Functions ---
    function clearImageUpload() {
        imageUploadInput.value = null;
        formElements.uploadedImageFile = null;
        chatImagePreviewContainer.style.display = 'none';
        chatImagePreview.src = "#";
        uploadStatusMessage.textContent = '';
        uploadStatusMessage.classList.remove('error');
        uploadTriggerButton.classList.remove('has-image');
        updatePlaceholderText(); // Update placeholder when image removed
    }

    function displayUploadStatus(message, isError = false) {
        uploadStatusMessage.textContent = message;
        uploadStatusMessage.classList.toggle('error', isError);
        chatImagePreviewContainer.style.display = message ? 'flex' : 'none';
        if (isError && chatImagePreview.src.endsWith('#')) {
            chatImagePreview.style.display = 'none';
        } else if (!isError) {
            chatImagePreview.style.display = 'block';
        }
    }

    function updatePlaceholderText() {
        const currentMode = formElements.mode();
        const hasImage = !!formElements.uploadedImageFile;

        if (currentMode === 'img2img') {
            formElements.prompt.placeholder = hasImage
                ? "Describe changes or prompt for the attached image..."
                : "Attach image and enter prompt...";
        } else {
            formElements.prompt.placeholder = "Enter prompt...";
        }
    }

    // --- Form Submission Logic ---
    if (submitButton) {
        submitButton.addEventListener('click', handleFormSubmit);
        promptTextarea.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); 
                handleFormSubmit(); 
            }
        });
    } else {
        console.error("Submit button not found!");
    }

    async function handleFormSubmit() {
        if (isGenerating) {
            console.log("Generation already in progress.");
            return; 
        }

        const currentMode = formElements.mode();
        const promptValue = formElements.prompt.value.trim();

        if (!promptValue) {
            alert("Please enter a prompt.");
            formElements.prompt.focus();
            return;
        }

        if (currentMode === 'img2img' && !formElements.uploadedImageFile) {
            alert("Please attach a valid image using the paperclip icon for Image to Image mode.");
            return;
        }

        // Create the request payload
        const requestData = {
            mode: currentMode,
            model: formElements.aiModel.value,
            prompt: promptValue,
            negativePrompt: formElements.negativePrompt.value.trim(),
            aspectRatio: formElements.aspectRatio.value,
            seed: formElements.seed.value,
            outputFormat: formElements.outputFormat.value
        };

        if (formElements.uploadedImageFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                // Extract the base64 part of the data URL
                requestData.uploadedImage = reader.result.split(',')[1];
                sendRequest(requestData);
            };
            reader.readAsDataURL(formElements.uploadedImageFile);
        } else {
            sendRequest(requestData);
        }
    }

    async function sendRequest(requestData) {
        setLoadingState(true);
        
        console.log("Sending request to:", SERVER_URL);
        console.log("Request data:", { ...requestData, prompt: requestData.prompt.substring(0, 50) + (requestData.prompt.length > 50 ? '...' : '') });
        
        try {
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            console.log("Response status:", response.status);
            
            // Try to parse JSON even if response is not OK to get error details
            const responseData = await response.json();
            console.log("Response data:", responseData);

            if (!response.ok) {
                throw new Error(responseData.error || `Server responded with status ${response.status}`);
            }

            if (responseData.success && (responseData.images || responseData.imageUrl)) {
                // Handle both image array format or single imageUrl format
                const images = responseData.images || [responseData.imageUrl];
                displayResults(images);
            } else {
                displayError(responseData.error || "No images were returned from the server.");
            }
        } catch (error) {
            console.error("API request failed:", error);
            displayError(error.message || "Failed to connect to the server.");
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        isGenerating = isLoading;
        submitButton.disabled = isLoading;
        promptTextarea.disabled = isLoading;
        uploadTriggerButton.disabled = isLoading || formElements.mode() !== 'img2img';

        sidebarControls.forEach(control => control.disabled = isLoading);

        submitButton.classList.toggle('is-loading', isLoading);
        promptTextarea.classList.toggle('is-loading', isLoading);

        outputPlaceholder.style.display = 'none';
        outputLoadingIndicator.style.display = isLoading ? 'flex' : 'none';
        
        if (isLoading) {
            outputImageGrid.innerHTML = ''; // Clear previous results when starting new generation
        }
    }

    function displayResults(imageUrls) {
        outputLoadingIndicator.style.display = 'none';
        outputPlaceholder.style.display = 'none';
        outputImageGrid.innerHTML = '';

        if (!imageUrls || imageUrls.length === 0) {
            outputPlaceholder.textContent = 'No images were generated.';
            outputPlaceholder.style.display = 'block';
            return;
        }

        imageUrls.forEach(url => {
            const imgElement = document.createElement('img');
            imgElement.src = url;
            imgElement.alt = "Generated Image";
            imgElement.loading = "lazy"; // Use lazy loading for better performance
            
            // Add download button for each image
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';
            
            // Create download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-button';
            downloadBtn.innerHTML = '<span class="material-icons">download</span>';
            downloadBtn.title = "Download image";
            downloadBtn.onclick = () => downloadImage(url);
            
            // Error handling
            imgElement.onerror = () => {
                imgElement.alt = "Image failed to load";
                imgElement.style.opacity = '0.5';
                imageContainer.classList.add('image-error');
            };
            
            imageContainer.appendChild(imgElement);
            imageContainer.appendChild(downloadBtn);
            outputImageGrid.appendChild(imageContainer);
        });
    }

    // Helper function to download images
    function downloadImage(url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function displayError(errorMessage) {
        outputLoadingIndicator.style.display = 'none';
        outputImageGrid.innerHTML = '';
        outputPlaceholder.textContent = `Error: ${errorMessage}`;
        outputPlaceholder.style.display = 'block';
        outputPlaceholder.style.color = 'var(--ctp-red)';
        
        // Add retry button on error
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Try Again';
        retryButton.className = 'retry-button';
        retryButton.onclick = () => {
            outputPlaceholder.style.display = 'none';
            outputPlaceholder.style.color = ''; // Reset color
        };
        
        outputPlaceholder.appendChild(document.createElement('br'));
        outputPlaceholder.appendChild(retryButton);
    }

    // Auto-resize the textarea as user types
    if (promptTextarea) {
        setTimeout(() => { autoResizeTextarea(promptTextarea); }, 0);
        promptTextarea.addEventListener('input', () => autoResizeTextarea(promptTextarea));
    }

    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    // Initialize UI state
    updatePlaceholderText();
    uploadTriggerButton.disabled = formElements.mode() !== 'img2img';

    // Add debugging info to help troubleshoot
    console.log("Image generation interface initialized");
    console.log("Server URL:", SERVER_URL);
});
