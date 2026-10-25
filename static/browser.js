(() => {
const video=document.getElementById('camera'), canvas=document.getElementById('drawCanvas'), ctx=canvas.getContext('2d');
const status=document.getElementById('status'), cameraBtn=document.getElementById('cameraBtn'), clearBtn=document.getElementById('clearBtn'), recognizeBtn=document.getElementById('recognizeBtn');
const mode=document.getElementById('mode'), result=document.getElementById('result'), confidence=document.getElementById('confidence');
ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';ctx.lineWidth=18;
let stream=null, camera=null, hands=null, lastPoint=null, drawing=false, pointerDrawing=false, lastPrediction=0;
function setStatus(s){status.textContent=s;}
function clearCanvas(){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);lastPoint=null;result.textContent='—';confidence.textContent='Canvas cleared.';}
clearBtn.addEventListener('click',clearCanvas);
canvas.addEventListener('pointerdown',e=>{pointerDrawing=true;lastPoint=canvasPoint(e);canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointerDrawing)return;const p=canvasPoint(e);drawSegment(lastPoint,p);lastPoint=p;});
['pointerup','pointercancel','pointerleave'].forEach(ev=>canvas.addEventListener(ev,()=>{pointerDrawing=false;lastPoint=null;}));
function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
function drawSegment(a,b){if(!a||!b)return;ctx.strokeStyle='#fff';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
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
 if(!res.multiHandLandmarks||!res.multiHandLandmarks.length){lastPoint=null;return;}
 const lm=res.multiHandLandmarks[0], index=lm[8], middle=lm[12], wrist=lm[0];
 const indexUp=index.y<lm[6].y, middleUp=middle.y<lm[10].y;
 // Draw only when index is extended and middle finger is folded.
 if(indexUp&&!middleUp){
  const p={x:(1-index.x)*canvas.width,y:index.y*canvas.height};
  if(lastPoint)drawSegment(lastPoint,p);lastPoint=p;
 }else{lastPoint=null;}
}
recognizeBtn.addEventListener('click',async()=>{
 const image=canvas.toDataURL('image/png');recognizeBtn.disabled=true;result.textContent='…';confidence.textContent='Running CNN prediction…';
 try{const res=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,mode:mode.value})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Prediction failed');result.textContent=data.label;confidence.textContent='Model score: '+(data.confidence*100).toFixed(1)+'%';setStatus('Prediction complete.');}
 catch(err){result.textContent='—';confidence.textContent=err.message;setStatus('Could not recognize this drawing.');}
 finally{recognizeBtn.disabled=false;}
});
window.addEventListener('pagehide',()=>{if(stream)stopCamera();});
})();