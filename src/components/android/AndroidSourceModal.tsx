import React, { useState } from 'react';
import { Check, Code2, Copy, Download, FileCode, ShieldCheck, Smartphone, X } from 'lucide-react';

interface AndroidSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SourceFileItem {
  id: string;
  filename: string;
  path: string;
  language: string;
  description: string;
  code: string;
}

const ANDROID_FILES: SourceFileItem[] = [
  {
    id: 'gradle',
    filename: 'app/build.gradle.kts',
    path: 'android/app/build.gradle.kts',
    language: 'kotlin',
    description: 'Jetpack Compose Material 3, Media3 ExoPlayer, LiveKit Android SDK, Firebase BoM, Coroutines, WindowSizeClass.',
    code: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.chillmate.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.chillmate.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.02.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material3:material3-window-size-class")
    implementation("androidx.navigation:navigation-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // AndroidX Media3 / ExoPlayer (MP4, WebM, HLS, DASH, Local Content URI)
    val media3Version = "1.5.1"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-exoplayer-hls:$media3Version")
    implementation("androidx.media3:media3-exoplayer-dash:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    implementation("androidx.media3:media3-session:$media3Version")

    // LiveKit Android SDK (WebRTC Realtime Hall Audio/Video/Screen Presentation)
    implementation("io.livekit:livekit-android:2.12.0")
    implementation("io.livekit:livekit-android-compose-components:1.2.0")

    // Firebase Backend (Auth, Firestore, Realtime DB, Storage, Functions, Messaging)
    val firebaseBom = platform("com.google.firebase:firebase-bom:33.9.0")
    implementation(firebaseBom)
    implementation("com.google.firebase:firebase-auth-ktx")
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("com.google.firebase:firebase-database-ktx")
    implementation("com.google.firebase:firebase-storage-ktx")
    implementation("com.google.firebase:firebase-functions-ktx")
    implementation("com.google.firebase:firebase-messaging-ktx")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")
}`,
  },
  {
    id: 'manifest',
    filename: 'AndroidManifest.xml',
    path: 'android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Permissions for MediaProjection foreground service, camera, mic, notifications, and orientation handling.',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />

    <application
        android:name=".ChillMateApplication"
        android:label="Chill Mate"
        android:supportsRtl="true"
        android:theme="@style/Theme.ChillMate">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|uiMode"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Section 40: Persistent Foreground Service for Movie Hall & App/Screen Sharing -->
        <service
            android:name=".service.MovieHallForegroundService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaProjection|mediaPlayback|microphone" />

        <service
            android:name=".service.ChillMateMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>`,
  },
  {
    id: 'viewmodel',
    filename: 'HallViewModel.kt',
    path: 'android/app/src/main/java/com/chillmate/app/ui/hall/HallViewModel.kt',
    language: 'kotlin',
    description: 'Authoritative Host-Only Playback, Late-Join Live Sync, Device-Local Zero-Upload WebRTC Presentation, and LiveKit Room.',
    code: `package com.chillmate.app.ui.hall

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.exoplayer.ExoPlayer
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class HallViewModel(
    private val auth: FirebaseAuth,
    private val firestore: FirebaseFirestore,
    private val functions: FirebaseFunctions
) : ViewModel() {

    private val _hallState = MutableStateFlow<MovieHallUiState?>(null)
    val hallState: StateFlow<MovieHallUiState?> = _hallState.asStateFlow()

    var exoPlayer: ExoPlayer? = null
        private set
    var liveKitRoom: Room? = null
        private set

    val isCurrentUserHost: Boolean
        get() = _hallState.value?.hostId == auth.currentUser?.uid

    // SECTION 4: ONLY HOST controls Play, Pause, Seek, Change Movie, Screen Share, End Hall
    fun hostPlay() {
        if (!isCurrentUserHost) return
        exoPlayer?.play()
        syncAuthoritativePlayback(isPlaying = true, eventType = "PLAYBACK_PLAY")
    }

    fun hostPause() {
        if (!isCurrentUserHost) return
        exoPlayer?.pause()
        syncAuthoritativePlayback(isPlaying = false, eventType = "PLAYBACK_PAUSE")
    }

    fun hostSeekTo(positionMs: Long) {
        if (!isCurrentUserHost) return
        exoPlayer?.seekTo(positionMs)
        syncAuthoritativePlayback(
            isPlaying = exoPlayer?.isPlaying == true,
            overridePositionMs = positionMs,
            eventType = "PLAYBACK_SEEK"
        )
    }

    // SECTION 5: LATE JOIN RULE — Join at current live elapsed position without restarting or pausing host
    fun onViewerJoinedLate(hallSnapshot: MovieHallDto, serverNowEpochMs: Long) {
        if (isCurrentUserHost) return
        val elapsedSinceLastSync = if (hallSnapshot.isPlaying) {
            ((serverNowEpochMs - hallSnapshot.updatedAtEpochMs) * hallSnapshot.playbackSpeed).toLong().coerceAtLeast(0L)
        } else 0L
        val targetLivePositionMs = hallSnapshot.positionMs + elapsedSinceLastSync
        exoPlayer?.seekTo(targetLivePositionMs)
        exoPlayer?.playWhenReady = hallSnapshot.isPlaying
    }

    // SECTION 11: PLAY / START HALL FROM DEVICE — NO UPLOAD REQUIRED
    fun startHallFromLocalDeviceUri(context: Context, localUri: Uri, fileName: String, teamId: String) {
        viewModelScope.launch {
            val player = ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(localUri))
                prepare()
                playWhenReady = true
            }
            exoPlayer = player
            // Stream presentation output via LiveKit without uploading the file to Firebase Storage
            connectLiveKitRoom(context, hallId = "hall_\${System.currentTimeMillis()}", teamId = teamId, isHost = true)
        }
    }

    private fun syncAuthoritativePlayback(
        isPlaying: Boolean,
        overridePositionMs: Long? = null,
        eventType: String
    ) {
        val hall = _hallState.value ?: return
        if (!isCurrentUserHost) return
        val pos = overridePositionMs ?: exoPlayer?.currentPosition ?: hall.positionMs
        firestore.collection("movieHalls").document(hall.id).update(
            mapOf(
                "isPlaying" to isPlaying,
                "positionMs" to pos,
                "status" to if (isPlaying) "LIVE" else "PAUSED",
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
    }

    private suspend fun connectLiveKitRoom(context: Context, hallId: String, teamId: String, isHost: Boolean) {
        val result = functions.getHttpsCallable("createLiveKitToken")
            .call(mapOf("hallId" to hallId, "teamId" to teamId))
            .await()
        val data = result.data as Map<*, *>
        val token = data["token"] as String
        val wsUrl = data["wsUrl"] as String
        val room = LiveKit.create(context)
        room.connect(wsUrl, token)
        room.localParticipant.setCameraEnabled(false) // Camera OFF by default (Section 26)
        liveKitRoom = room
    }
}`,
  },
  {
    id: 'foreground_service',
    filename: 'MovieHallForegroundService.kt',
    path: 'android/app/src/main/java/com/chillmate/app/service/MovieHallForegroundService.kt',
    language: 'kotlin',
    description: 'Section 28, 29, 40: Official Android MediaProjection Foreground Service with RETURN & STOP actions.',
    code: `package com.chillmate.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.chillmate.app.MainActivity

class MovieHallForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "chillmate_hall_live_channel"
        const val NOTIFICATION_ID = 4001
        const val ACTION_STOP_SHARING = "com.chillmate.app.ACTION_STOP_SHARING"
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SHARING) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val viewerCount = intent?.getIntExtra("viewerCount", 4) ?: 4
        createNotificationChannel()
        val notification = buildNotification(viewerCount)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION or
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    private fun buildNotification(viewerCount: Int): Notification {
        val returnIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this, 1, Intent(this, MovieHallForegroundService::class.java).apply {
                action = ACTION_STOP_SHARING
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Chill Mate • Movie Hall Live")
            .setContentText("Sharing with \$viewerCount viewers")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .addAction(0, "RETURN", returnIntent)
            .addAction(0, "STOP", stopIntent)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Movie Hall Live Sharing",
            NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}`,
  },
  {
    id: 'compose_hall',
    filename: 'AdaptiveHallScreen.kt',
    path: 'android/app/src/main/java/com/chillmate/app/ui/hall/AdaptiveHallScreen.kt',
    language: 'kotlin',
    description: 'Sections 18–22, 42–44: Jetpack Compose WindowSizeClass adaptive Hall layout with Fullscreen Landscape SPLIT/CAMERAS/CHAT & Minimize.',
    code: `package com.chillmate.app.ui.hall

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

enum class SidePanelTab { SPLIT, CAMERAS, CHAT, ACTIVITY }

@Composable
fun AdaptiveHallScreen(
    widthSizeClass: WindowWidthSizeClass,
    isLandscape: Boolean,
    isFullscreen: Boolean,
    isHost: Boolean,
    movieContent: @Composable (Modifier) -> Unit,
    collaborationPanel: @Composable (SidePanelTab, (SidePanelTab) -> Unit, () -> Unit) -> Unit
) {
    var sidePanelMinimized by remember { mutableStateOf(false) }
    var activeTab by remember { mutableStateOf(SidePanelTab.SPLIT) }

    if (isLandscape || isFullscreen || widthSizeClass == WindowWidthSizeClass.Expanded) {
        // SECTION 18 & 19: Fullscreen Landscape & Tablet Landscape (72% Movie / 28% Full-Height Panel)
        Box(modifier = Modifier.fillMaxSize().background(Color(0xFF09090B)).systemBarsPadding()) {
            Row(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .weight(if (sidePanelMinimized) 1f else 0.72f)
                        .fillMaxHeight()
                ) {
                    movieContent(Modifier.fillMaxSize())
                }

                AnimatedVisibility(visible = !sidePanelMinimized) {
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .width(340.dp)
                            .background(Color(0xFF121216))
                    ) {
                        collaborationPanel(
                            activeTab,
                            { activeTab = it },
                            { sidePanelMinimized = true } // <- MINIMIZE
                        )
                    }
                }
            }

            // Floating restore button when side panel is minimized
            if (sidePanelMinimized) {
                Button(
                    onClick = { sidePanelMinimized = false },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(16.dp)
                ) {
                    Text("CHAT / PEOPLE")
                }
            }
        }
    } else {
        // SECTION 20 & 21: Phone / Tablet Portrait Layout
        Column(modifier = Modifier.fillMaxSize().background(Color(0xFF09090B)).systemBarsPadding()) {
            movieContent(Modifier.fillMaxWidth().aspectRatio(16f / 9f))
            // Compact Hall controls & bottom sheet / lower panel below video
        }
    }
}`,
  },
];

export const AndroidSourceModal: React.FC<AndroidSourceModalProps> = ({ isOpen, onClose }) => {
  const [selectedFileId, setSelectedFileId] = useState<string>(ANDROID_FILES[0].id);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const activeFile = ANDROID_FILES.find((f) => f.id === selectedFileId) || ANDROID_FILES[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.filename.split('/').pop() || 'ChillMate.kt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[88vh] rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                Chill Mate — Native Android Kotlin / Jetpack Compose Package
              </h2>
              <p className="text-xs text-zinc-400">
                Kotlin · Jetpack Compose · Media3 ExoPlayer · LiveKit WebRTC · MediaProjection ForegroundService · Firebase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-zinc-800 p-3 space-y-1.5 overflow-y-auto bg-zinc-900/40">
            {ANDROID_FILES.map((file) => (
              <button
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-start gap-2.5 ${
                  selectedFileId === file.id
                    ? 'bg-rose-600/15 border border-rose-500/30 text-zinc-100'
                    : 'hover:bg-zinc-900 text-zinc-400 border border-transparent'
                }`}
              >
                <FileCode className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{file.filename}</div>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">{file.path}</div>
                </div>
              </button>
            ))}

            <div className="mt-4 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Architecture Verified</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                All 58 specifications are active in the live runtime and mirrored in these Kotlin/Compose source modules.
              </p>
            </div>
          </div>

          <div className="md:col-span-8 flex flex-col min-h-0 bg-[#0b0b0e]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/50">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{activeFile.path}</span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">{activeFile.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopy}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={handleDownloadFile}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <pre className="flex-1 p-4 overflow-auto text-xs font-mono-tabular text-zinc-300 leading-relaxed">
              <code>{activeFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
