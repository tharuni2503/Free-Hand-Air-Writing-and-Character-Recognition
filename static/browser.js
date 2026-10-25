(() => {
const video=document.getElementById('camera'), canvas=document.getElementById('drawCanvas'), ctx=canvas.getContext('2d');
const status=document.getElementById('status'), cameraBtn=document.getElementById('cameraBtn'), clearOverlayBtn=document.getElementById('clearOverlayBtn'), recognizeOverlayBtn=document.getElementById('recognizeOverlayBtn');
const mode=document.getElementById('mode'), result=document.getElementById('result'), confidence=document.getElementById('confidence');
ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#ff2020';ctx.lineWidth=12;
let currentColor='#ff2020', erasing=false;
document.querySelectorAll('[data-color]').forEach(btn=>btn.addEventListener('click',()=>{currentColor=btn.dataset.color;erasing=false;document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('active',b===btn));document.getElementById('eraserBtn').classList.remove('active');}));
document.getElementById('eraserBtn').addEventListener('click',()=>{erasing=true;document.getElementById('eraserBtn').classList.add('active');document.querySelectorAll('[data-color]').forEach(b=>b.classList.remove('active'));});
let stream=null, camera=null, hands=null, lastPoint=null, drawing=false, pointerDrawing=false, lastPrediction=0, openPalmSince=null, clearGestureLatched=false, clearHoverSince=null, clearHoverLatched=false, recognizeHoverSince=null, recognizeHoverLatched=false;
function setStatus(s){status.textContent=s;}
function clearCanvas(){ctx.clearRect(0,0,canvas.width,canvas.height);lastPoint=null;result.textContent='—';confidence.textContent='';}
clearOverlayBtn.addEventListener('click',clearCanvas);
canvas.addEventListener('pointerdown',e=>{pointerDrawing=true;lastPoint=canvasPoint(e);canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointerDrawing)return;const p=canvasPoint(e);drawSegment(lastPoint,p);lastPoint=p;});
['pointerup','pointercancel','pointerleave'].forEach(ev=>canvas.addEventListener(ev,()=>{pointerDrawing=false;lastPoint=null;}));
function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
function drawSegment(a,b){if(!a||!b)return;ctx.globalCompositeOperation=erasing?'destination-out':'source-over';ctx.strokeStyle=currentColor;ctx.lineWidth=erasing?34:12;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalCompositeOperation='source-over';}
async function startCamera(){
 if(!navigator.mediaDevices?.getUserMedia){setStatus('This browser does not support camera access. Try a recent browser over HTTPS.');return;}
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});video.srcObject=stream;await video.play();
  if(!window.Hands||!window.Camera){setStatus('Camera started, but hand-tracking scripts failed to load. Mouse/touch drawing still works.');return;}
  hands=new Hands({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
  hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:.65,minTrackingConfidence:.6});
  hands.onResults(onResults);
  camera=new Camera(video,{onFrame:async()=>{if(hands)await hands.send({image:video});},width:640,height:480});
  await camera.start();cameraBtn.textContent='Stop camera';setStatus('Camera is running. Show one hand; point your index finger to draw.');
 }catch(err){setStatus('Could not start camera: '+(err.message||err)+' — check browser camera permission.');}
}
function stopCamera(){if(camera){camera.stop();camera=null;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}if(hands){hands.close();hands=null;}video.srcObject=null;cameraBtn.textContent='Start camera';lastPoint=null;setStatus('Camera stopped. Mouse/touch drawing is still available.');}
cameraBtn.addEventListener('click',()=>{if(stream)stopCamera();else startCamera();});
function onResults(res){
 if(!res.multiHandLandmarks||!res.multiHandLandmarks.length){lastPoint=null;openPalmSince=null;clearGestureLatched=false;clearHoverSince=null;clearHoverLatched=false;recognizeHoverSince=null;recognizeHoverLatched=false;clearOverlayBtn.classList.remove('gesture-hover');recognizeOverlayBtn.classList.remove('gesture-hover');return;}
 const lm=res.multiHandLandmarks[0];
 const indexUp=lm[8].y<lm[6].y, middleUp=lm[12].y<lm[10].y;
 const ringUp=lm[16].y<lm[14].y, pinkyUp=lm[20].y<lm[18].y;
 const openPalm=indexUp&&middleUp&&ringUp&&pinkyUp;
 // Hold an open palm for 1.2 seconds to clear; one clear per gesture.
 if(openPalm){
  lastPoint=null;
  if(!clearGestureLatched){
   if(openPalmSince===null)openPalmSince=Date.now();
   const elapsed=Date.now()-openPalmSince;
   setStatus(elapsed>=1200?'Open-palm gesture detected — clearing canvas.':'Hold open palm to clear canvas…');
   if(elapsed>=1200){clearCanvas();setStatus('Canvas cleared by gesture. Point your index finger to write.');clearGestureLatched=true;openPalmSince=null;}
  }
  return;
 }else{openPalmSince=null;clearGestureLatched=false;}
 // Draw only when index is extended and middle finger is folded.
 if(indexUp&&!middleUp){
  const p={x:(1-lm[8].x)*canvas.width,y:lm[8].y*canvas.height};
  const cr=canvas.getBoundingClientRect(), br=clearOverlayBtn.getBoundingClientRect(), rr=recognizeOverlayBtn.getBoundingClientRect();
  const fingertipX=cr.left+(1-lm[8].x)*cr.width, fingertipY=cr.top+lm[8].y*cr.height;
  const overClear=fingertipX>=br.left&&fingertipX<=br.right&&fingertipY>=br.top&&fingertipY<=br.bottom;
  const overRecognize=fingertipX>=rr.left&&fingertipX<=rr.right&&fingertipY>=rr.top&&fingertipY<=rr.bottom;
  if(overRecognize){
   lastPoint=null;clearHoverSince=null;clearHoverLatched=false;clearOverlayBtn.classList.remove('gesture-hover');
   if(!recognizeHoverLatched){if(recognizeHoverSince===null)recognizeHoverSince=Date.now();recognizeOverlayBtn.classList.add('gesture-hover');
    const elapsed=Date.now()-recognizeHoverSince;setStatus(elapsed>=900?'Recognizing character…':'Hold your fingertip over ✓ Recognize…');
    if(elapsed>=900){recognizeCharacter();recognizeHoverLatched=true;recognizeHoverSince=null;setStatus('Recognizing character…');}
   }
   return;
  }else{recognizeHoverSince=null;recognizeHoverLatched=false;recognizeOverlayBtn.classList.remove('gesture-hover');}
  if(overClear){
   lastPoint=null;
   if(!clearHoverLatched){if(clearHoverSince===null)clearHoverSince=Date.now();clearOverlayBtn.classList.add('gesture-hover');
    const elapsed=Date.now()-clearHoverSince;setStatus(elapsed>=900?'Clearing canvas…':'Hold your fingertip over ✕ Clear…');
    if(elapsed>=900){clearCanvas();clearHoverLatched=true;clearHoverSince=null;setStatus('Canvas cleared by fingertip. Point at the canvas to write again.');}
   }
   return;
  }else{clearHoverSince=null;clearHoverLatched=false;clearOverlayBtn.classList.remove('gesture-hover');}
  if(lastPoint)drawSegment(lastPoint,p);lastPoint=p;
  setStatus('Writing: point your fingertip at ✕ Clear and hold to clear.');
 }else{lastPoint=null;if(middleUp)setStatus('Drawing paused. Open palm + hold to clear canvas.');}
}
async function recognizeCharacter(){
 const image=canvas.toDataURL('image/png');recognizeBtn.disabled=true;result.textContent='…';confidence.textContent='Running CNN prediction…';
 try{const res=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,mode:mode.value})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Prediction failed');result.textContent=data.label;confidence.textContent='Model score: '+(data.confidence*100).toFixed(1)+'%';setStatus('Prediction complete.');}
 catch(err){result.textContent='—';confidence.textContent=err.message;setStatus('Could not recognize this drawing.');}
}
recognizeOverlayBtn.addEventListener('click',recognizeCharacter);
window.addEventListener('pagehide',()=>{if(stream)stopCamera();});
})();