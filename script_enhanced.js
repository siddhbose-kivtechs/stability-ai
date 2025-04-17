
// script_enhanced.js - Enhanced Frontend Script with BSON support
 // Using BSON endpoint
const SERVER_URL = 'https://aws-bedrock-stability-1.onrender.com/api/image/stability/bson';
// const SERVER_URL='http://localhost:8000/api/image/stability/bson';

document.addEventListener("DOMContentLoaded", () => {
    // --- Element Selections ---
    const modeRadios = document.querySelectorAll('input[name="generation-mode"]');
    const imageUploadInput = document.getElementById('image-upload');
    const uploadTriggerButton = document.getElementById('upload-trigger-button');
    const chatImagePreviewContainer = document.getElementById('chat-image-preview-container');
    const chatImagePreview = document.getElementById('chat-image-preview');
    const uploadStatusMessage = document.getElementById('upload-status');
    const removeImageButton = document.getElementById('remove-image-button');

    const submitButton = document.querySelector('.submit-button');
    const promptTextarea = document.getElementById('prompt');
    const outputArea = document.querySelector('.output-area');
    const outputPlaceholder = outputArea.querySelector('.placeholder');
    const outputLoadingIndicator = outputArea.querySelector('.loading-indicator');
    const outputImageGrid = outputArea.querySelector('.image-grid');
    const statusDisplay = document.getElementById('status'); // Added status display element

    // Sidebar elements for potential disabling
    const sidebarControls = document.querySelectorAll('.sidebar select, .sidebar input, .sidebar textarea, .sidebar button:not(.settings-button)');

    const formElements = {
        mode: () => document.querySelector('input[name="generation-mode"]:checked').value,
        aiModel: document.getElementById('ai-model'),
        prompt: promptTextarea,
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

    // --- Status Display Functions (from DALL-E 3) ---
    function showStatus(message, type) {
        statusDisplay.textContent = message;
        statusDisplay.className = "status";
        if (type) statusDisplay.classList.add(type);
        
        // Auto-hide success messages after 5 seconds
        if (type === "success") {
            setTimeout(() => {
                statusDisplay.classList.remove("success");
                statusDisplay.textContent = "";
            }, 5000);
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
            showStatus("Please enter a prompt.", "error");
            formElements.prompt.focus();
            return;
        }

        if (currentMode === 'img2img' && !formElements.uploadedImageFile) {
            showStatus("Please attach a valid image for Image to Image mode.", "error");
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
        showStatus("Generating image...", "loading");
        
        console.log("Sending request to:", SERVER_URL);
        console.log("Request data:", { 
            ...requestData, 
            prompt: requestData.prompt.substring(0, 50) + (requestData.prompt.length > 50 ? '...' : ''),
            // Don't log full image data
            uploadedImage: requestData.uploadedImage ? "[BASE64 IMAGE DATA]" : null
        });
        
        try {
            // Serialize the request data to BSON
            const bsonData = BSON.serialize(requestData);
            
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/bson',
                },
                body: bsonData
            });

            console.log("Response status:", response.status);
            
            if (response.ok && response.headers.get("Content-Type") === "application/bson") {
                // Parse BSON response
                const buffer = await response.arrayBuffer();
                const result = BSON.deserialize(new Uint8Array(buffer));
                console.log("Server Response Data: ", result);

                if (result.error) {
                    displayError(result.error);
                } else {
                    // Handle both image array format or single imageUrl format
                    const images = result.images || result.data || [result.imageUrl];
                    displayResults(images, requestData.prompt);
                    showStatus("Image generated successfully!", "success");
                }
            } else {
                try {
                    // Try to handle non-BSON responses
                    const text = await response.text();
                    try {
                        const errorData = JSON.parse(text);
                        displayError(errorData.error || `Server error: ${response.status}`);
                    } catch (parseErr) {
                        // If not JSON, just display the text
                        displayError(text);
                    }
                } catch (textErr) {
                    displayError("Unable to read response from server");
                }
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

    function displayResults(imageUrls, promptText) {
        outputLoadingIndicator.style.display = 'none';
        outputPlaceholder.style.display = 'none';
        outputImageGrid.innerHTML = '';

        if (!imageUrls || imageUrls.length === 0) {
            outputPlaceholder.textContent = 'No images were generated.';
            outputPlaceholder.style.display = 'block';
            return;
        }
        
        // First, show the prompt that was used
        const promptDisplay = document.createElement("div");
        promptDisplay.className = "prompt-text";
        promptDisplay.innerHTML = `<p>Prompt Used:</p><p>${promptText}</p>`;
        outputImageGrid.appendChild(promptDisplay);
        
        // Create a container for the images
        const imagesContainer = document.createElement("div");
        imagesContainer.className = "images-container";
        outputImageGrid.appendChild(imagesContainer);

        imageUrls.forEach((url, i) => {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-item';
            
            // Create image element
            const imgElement = document.createElement('img');
            imgElement.src = url;
            imgElement.alt = `Generated Image ${i + 1}`;
            imgElement.className = 'generated-image';
            imgElement.loading = "lazy";
            
            // Add loading animation
            imgElement.style.opacity = "0";
            imgElement.onload = function() {
                this.style.transition = "opacity 0.5s ease";
                this.style.opacity = "1";
            };
            
            // Error handling for image
            imgElement.onerror = () => {
                imgElement.alt = "Image failed to load";
                imgElement.style.opacity = '0.5';
                imageContainer.classList.add('image-error');
            };
            
            imageContainer.appendChild(imgElement);
            
            // Add URL display section
            const urlDisplay = document.createElement("div");
            urlDisplay.className = "image-url";
            urlDisplay.innerHTML = `<p>Image URL:</p><input type="text" value="${url}" readonly onClick="this.select();" />`;
            imageContainer.appendChild(urlDisplay);
            
            // Add action buttons container
            const actionButtons = document.createElement("div");
            actionButtons.className = "action-buttons";
            
            // Add copy URL button
            const copyButton = document.createElement("button");
            copyButton.textContent = "Copy URL";
            copyButton.className = "copy-url-btn";
            copyButton.onclick = function () {
                navigator.clipboard.writeText(url)
                  .then(() => {
                    this.textContent = "Copied!";
                    setTimeout(() => {
                      this.textContent = "Copy URL";
                    }, 2000);
                  })
                  .catch(err => {
                    console.error('Failed to copy: ', err);
                  });
            };
            actionButtons.appendChild(copyButton);
            
            // Add Download Button
            const downloadButton = document.createElement("a");
            downloadButton.href = url;
            downloadButton.download = `stability_image_${i + 1}.png`; // Suggest a filename
            downloadButton.textContent = "Download";
            downloadButton.className = "download-btn";
            actionButtons.appendChild(downloadButton);
            
            imageContainer.appendChild(actionButtons);
            imagesContainer.appendChild(imageContainer);
        });
    }

    function displayError(errorMessage) {
        outputLoadingIndicator.style.display = 'none';
        outputImageGrid.innerHTML = '';
        
        // Format error message
        let errorText = "Error: ";
        if (typeof errorMessage === 'object') {
            errorText += errorMessage.message || JSON.stringify(errorMessage);
        } else {
            errorText += errorMessage;
        }
        
        outputPlaceholder.innerHTML = `
          <div class="error-container">
            <div class="error-icon">⚠️</div>
            <div class="error-message">${errorText}</div>
          </div>
        `;
        outputPlaceholder.style.display = 'block';
        showStatus(errorText, "error");
        
        // Add retry button on error
        const retryButton = document.createElement('button');
        retryButton.textContent = 'Try Again';
        retryButton.className = 'retry-button';
        retryButton.onclick = () => {
            outputPlaceholder.style.display = 'none';
            showStatus("", ""); // Clear status
        };
        
        outputPlaceholder.appendChild(document.createElement('br'));
        outputPlaceholder.appendChild(retryButton);
    }

    // Auto-resize the textarea as user types (from DALL-E 3 project)
    function convertToAutoExpandingInput(element) {
        // Apply auto-expanding behavior to existing textarea
        element.addEventListener("input", function() {
            // Reset height to auto and then set to scrollHeight
            this.style.height = "auto";
            this.style.height = (this.scrollHeight) + "px";
        });
        
        // Initial adjustment
        setTimeout(() => {
            element.style.height = "auto";
            element.style.height = (element.scrollHeight) + "px";
        }, 0);
        
        return element;
    }

    // Initialize auto-expanding textarea
    convertToAutoExpandingInput(promptTextarea);

    // Initialize UI state
    updatePlaceholderText();
    uploadTriggerButton.disabled = formElements.mode() !== 'img2img';

    // Add debugging info to help troubleshoot
    console.log("Enhanced image generation interface initialized");
    console.log("Server URL:", SERVER_URL);
});
