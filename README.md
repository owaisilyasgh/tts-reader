# Sentence-by-Sentence TTS Reader

A client-side, responsive web application that reads uploaded text files aloud sentence by sentence using the [Google Cloud Text-to-Speech API](https://cloud.google.com/text-to-speech). The app splits text into sentences (while combining very short ones based on a user-defined minimum length), caches audio for each sentence, and provides a modern, mobile-friendly UI.

## Features

- **File Upload & Display:**  
  Upload plain text files and display them with preserved paragraph formatting.

- **Sentence Splitting & Combining:**  
  Uses an enhanced regex to split text into sentences while avoiding breaks on common abbreviations (e.g., "Dr.", "Mr.", etc.). Also combines adjacent short sentences (default minimum length of 150 characters, configurable via Advanced Settings) to reduce API calls.

- **Google Cloud TTS Integration:**  
  Converts each sentence to audio using the Google Cloud TTS API. Supports both SSML and plain text input based on the selected voice.

- **Voice Selection & Sorting:**  
  - Voice dropdown is dynamically populated and cached (using localStorage) to reduce API calls.
  - Voices are sorted so that any voice containing "Chirp" appears at the top.
  - Friendly voice labels are generated (e.g., "Chirp3 HD D (male) - en-AU").

- **Responsive & Modern UI:**  
  - Mobile-friendly design with responsive layouts.
  - Advanced Settings panel hides the API key and minimum sentence length controls by default (accessible via a gear icon).
  - A status bar shows the latest event (e.g., when a sentence is sent to the API, cached, or when playback stops).

- **Dynamic Voice Change:**  
  If the voice is changed mid-playback, the new voice is applied automatically to the next sentence.

- **Audio Caching & Prefetching:**  
  Audio for each sentence is cached to minimize API calls and reduce delays. The next sentence is pre-fetched in the background.

## Getting Started

### Prerequisites

- **Google Cloud TTS API Key:**  
  Obtain a valid API key from the [Google Cloud Console](https://console.cloud.google.com/) with access to the Text-to-Speech API.

### Running the App

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/tts-reader.git
   cd tts-reader
