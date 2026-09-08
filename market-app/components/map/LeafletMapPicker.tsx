/**
 * LeafletMapPicker — Leaflet map inside a WebView for React Native.
 * Works in Expo Go and dev builds — no native map module required.
 *
 * Props:
 *   latitude / longitude  — current pin (null = no pin yet, shows Bago City centre)
 *   onLocationSelect(lat, lng) — fires when user taps map or drags pin
 *   height — view height in pixels (default 300)
 *
 * Ref methods:
 *   jumpTo(lat, lng) — programmatically move the map + pin (used for GPS jump)
 */
import React, {
  useRef, useCallback, useImperativeHandle, forwardRef,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface LeafletMapPickerRef {
  jumpTo: (lat: number, lng: number) => void;
}

interface Props {
  latitude:  number | null;
  longitude: number | null;
  onLocationSelect: (lat: number, lng: number) => void;
  height?: number;
}

const BAGO_LAT =  10.5340;
const BAGO_LNG = 122.8374;
const DEFAULT_ZOOM = 16;

function buildHtml(lat: number | null, lng: number | null): string {
  const cLat = lat ?? BAGO_LAT;
  const cLng = lng ?? BAGO_LNG;

  const markerInit = (lat && lng)
    ? `marker = L.marker([${lat},${lng}],{draggable:true}).addTo(map); bindDrag(marker);`
    : `marker = null;`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body,#map{width:100%;height:100%;touch-action:none;}
    .leaflet-control-attribution{display:none;}
  </style>
</head>
<body>
<div id="map"></div>
<script>
var map=L.map('map',{center:[${cLat},${cLng}],zoom:${DEFAULT_ZOOM},zoomControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var marker;

function bindDrag(m){
  m.on('dragend',function(e){
    var ll=e.target.getLatLng();
    send(ll.lat,ll.lng);
  });
}

function send(lat,lng){
  window.ReactNativeWebView.postMessage(JSON.stringify({lat:lat,lng:lng}));
}

function placeMarker(lat,lng){
  if(marker){marker.setLatLng([lat,lng]);}
  else{marker=L.marker([lat,lng],{draggable:true}).addTo(map);bindDrag(marker);}
  send(lat,lng);
}

${markerInit}

map.on('click',function(e){
  placeMarker(e.latlng.lat,e.latlng.lng);
});

// Receive jump commands from React Native
function handleMsg(raw){
  try{
    var d=JSON.parse(raw);
    if(d.cmd==='jump'&&d.lat&&d.lng){
      map.setView([d.lat,d.lng],${DEFAULT_ZOOM});
      placeMarker(d.lat,d.lng);
    }
  }catch(e){}
}
document.addEventListener('message',function(e){handleMsg(e.data);});
window.addEventListener('message',function(e){handleMsg(e.data);});
</script>
</body>
</html>`;
}

const LeafletMapPicker = forwardRef<LeafletMapPickerRef, Props>(function LeafletMapPicker(
  { latitude, longitude, onLocationSelect, height = 300 },
  ref
) {
  const webViewRef = useRef<WebView>(null);

  // Expose jumpTo via ref
  useImperativeHandle(ref, () => ({
    jumpTo(lat: number, lng: number) {
      webViewRef.current?.postMessage(JSON.stringify({ cmd: 'jump', lat, lng }));
    },
  }), []);

  const handleMessage = useCallback((event: any) => {
    try {
      const d = JSON.parse(event.nativeEvent.data);
      if (typeof d.lat === 'number' && typeof d.lng === 'number') {
        onLocationSelect(d.lat, d.lng);
      }
    } catch {}
  }, [onLocationSelect]);

  const html = buildHtml(latitude, longitude);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        // Prevent the webview from intercepting scroll on surrounding ScrollView
        nestedScrollEnabled={false}
      />
    </View>
  );
});

export default LeafletMapPicker;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
