Free-Hand Air Writing and Character Recognition

This project allows users to write alphabets and digits in the air using their index finger. A webcam tracks the fingertip using MediaPipe, draws the strokes using OpenCV, and predicts the written character using a CNN (TensorFlow/Keras) model.

✨ Features

Real-time hand & fingertip tracking

Air writing using webcam

Draw on a virtual canvas

Recognizes A–Z alphabets and 0–9 digits

Multi-color drawing support

Eraser tool

Alphabet mode, Number mode, and Off mode

Contactless, hygienic, and user-friendly

📌 Project Structure
Free-Hand-Air-Writing-and-Character-Recognition/
│
├── VirtualPainter.py          # Main program (drawing + prediction)
├── HandTrackingModule.py      # Fingertip detection
├── app.py                     # Flask web interface
│
├── bestmodel.h5               # Digit recognition model
├── bModel.h5                  # Alphabet recognition model
│
├── header/                    # Toolbar images
├── static/                    # CSS + sample images
└── templates/                 # HTML files

🛠️ Technologies Used

Python

OpenCV

MediaPipe

TensorFlow / Keras

PyGame

Flask (optional web interface)

⚙️ Installation
git clone https://github.com/tharuni2503/Free-Hand-Air-Writing-and-Character-Recognition
cd Free-Hand-Air-Writing-and-Character-Recognition
pip install -r requirement.txt

▶️ Run the Application
1. Run air writing (normal mode)
python VirtualPainter.py

2. Run the web interface
python app.py


Visit:

http://127.0.0.1:5000

⌨️ Controls

A → Alphabet Mode

N → Number Mode

O → Turn Off Recognition

One finger → Draw

Two fingers → Pause

Toolbar click → Color change / Eraser / Quit

🧠 How It Works (Simple Explanation)

Webcam captures the video.

MediaPipe detects the hand and the index fingertip.

Movement is drawn on a virtual canvas.

The drawing is preprocessed to 28×28 grayscale.

CNN model predicts the character.

Output is displayed in real time.

🚀 Future Enhancements

Predict continuous handwriting (full words)

Multilingual character recognition

Mobile app version

Faster recognition using lightweight models

Gesture-based undo/redo

📄 License


This project is for educational and research purposes.
