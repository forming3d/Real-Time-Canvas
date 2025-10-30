import React from "react";
import DrawingCanvas from "./DrawingCanvas";

export default function App() {
  return (
    <div style={{
      minHeight:"100dvh",
      background:"#000",
      color:"#ddd",
      display:"grid",
      placeItems:"center",
      padding:"24px"
    }}>
      <div style={{width:"min(720px, 95vw)"}}>
        <h1 style={{margin:"0 0 12px 0", fontSize:24, color:"#fff"}}>Real-Time Canvas (replicado)</h1>
        <p style={{marginTop:0, opacity:0.7}}>
          Dibuja en el lienzo 512×512. Se envía por WebSocket como <code>{`{type:"draw", payload:"data:image/...;base64,..."}`}</code>.  
          El texto se manda como <code>{`{type:"proc", payload:"..."}`}</code>.
        </p>
        <DrawingCanvas />
      </div>
    </div>
  );
}
