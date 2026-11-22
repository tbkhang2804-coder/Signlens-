import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkCallRoom,
  extractRoomCodeFromInput,
  HostPeerRoomBridge,
  type CallTransportMode,
} from '../utils/webrtcClient';
import CallConnectHub from './call/CallConnectHub';
import PreCallLobby from './call/PreCallLobby';
import ActiveCallRoom from './call/ActiveCallRoom';

interface ConnectPageProps {
  initialInviteRoom?: string;
  onConsumeInviteRoom?: () => void;
  onToast: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  studioTrainedCount?: number;
}

type CallStage = 'hub' | 'lobby' | 'in_call';

export default function ConnectPage({
  initialInviteRoom = '',
  onConsumeInviteRoom,
  onToast,
  studioTrainedCount = 0,
}: ConnectPageProps) {
  const [stage, setStage] = useState<CallStage>('hub');
  const [roomCode, setRoomCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [transportMode, setTransportMode] = useState<CallTransportMode>('ws');
  const [role, setRole] = useState<'deaf' | 'hearing'>('deaf');
  const [hubError, setHubError] = useState<string | null>(null);
  const [prefillCode, setPrefillCode] = useState('');
  const [checkingInviteCode, setCheckingInviteCode] = useState<string | null>(null);

  const hostBridgeRef = useRef<HostPeerRoomBridge | null>(null);
  const lastHandledInviteRef = useRef<string>('');

  // Handed-off from PreCallLobby to ActiveCallRoom
  const [callConfig, setCallConfig] = useState<{
    stream: MediaStream | null;
    camOn: boolean;
    micOn: boolean;
    selectedCamId: string;
    displayName: string;
  } | null>(null);

  const destroyHostBridge = useCallback((endRoom: boolean) => {
    if (hostBridgeRef.current) {
      hostBridgeRef.current.destroy(endRoom);
      hostBridgeRef.current = null;
    }
  }, []);

  const ensureHostBridge = useCallback(
    (code: string) => {
      if (hostBridgeRef.current && hostBridgeRef.current.roomCode !== code) {
        hostBridgeRef.current.destroy(true);
        hostBridgeRef.current = null;
      }
      if (!hostBridgeRef.current) {
        const bridge = new HostPeerRoomBridge(code);
        hostBridgeRef.current = bridge;
        void bridge.start();
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      destroyHostBridge(false);
    };
  }, [destroyHostBridge]);

  // Automatically validate & open PreCallLobby if opened via ?room=SL-XXXX invite link
  useEffect(() => {
    if (!initialInviteRoom || lastHandledInviteRef.current === initialInviteRoom) return;
    lastHandledInviteRef.current = initialInviteRoom;

    const normalized = extractRoomCodeFromInput(initialInviteRoom);
    if (!normalized) {
      onConsumeInviteRoom?.();
      setHubError('Liên kết mời có mã phòng không hợp lệ.');
      return;
    }

    let active = true;
    setPrefillCode(normalized);
    setCheckingInviteCode(normalized);

    checkCallRoom(normalized)
      .then((res) => {
        if (!active) return;
        if (!res.exists || res.status === 'not_found') {
          setHubError(res.error || `Phòng ${normalized} không tồn tại hoặc đã hết hạn.`);
          return;
        }
        if (res.status === 'ended') {
          setHubError(`Phòng ${normalized} đã kết thúc cuộc gọi.`);
          return;
        }
        if (res.full) {
          setHubError(`Phòng ${normalized} hiện đã đủ 2 người tham gia.`);
          return;
        }
        setHubError(null);
        setRoomCode(normalized);
        setIsHost(false);
        setTransportMode(res.transport || 'ws');
        setStage('lobby');
        onToast('info', `Đang mở phòng ${normalized}. Hãy kiểm tra camera & micro trước khi tham gia.`);
      })
      .finally(() => {
        if (active) {
          setCheckingInviteCode(null);
          onConsumeInviteRoom?.();
        }
      });

    return () => {
      active = false;
    };
  }, [initialInviteRoom, onConsumeInviteRoom, onToast]);

  if (checkingInviteCode && stage === 'hub') {
    return (
      <section className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="glass-card rounded-3xl p-7 space-y-3">
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Đang kết nối tới phòng {checkingInviteCode}...
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Hệ thống đang tìm phòng gọi video từ chủ phòng. Vui lòng giữ nguyên trang trong giây lát.
          </p>
        </div>
      </section>
    );
  }

  if (stage === 'lobby' && roomCode) {
    return (
      <PreCallLobby
        roomCode={roomCode}
        isHost={isHost}
        selectedRole={role}
        onRoleChange={setRole}
        onBack={() => {
          if (isHost) {
            destroyHostBridge(false);
          }
          setStage('hub');
          setCallConfig(null);
        }}
        onJoinCall={(params) => {
          setCallConfig(params);
          setStage('in_call');
        }}
        onToast={onToast}
      />
    );
  }

  if (stage === 'in_call' && roomCode && callConfig) {
    return (
      <ActiveCallRoom
        roomCode={roomCode}
        isHost={isHost}
        transportMode={transportMode}
        hostBridge={isHost ? hostBridgeRef.current : null}
        role={role}
        displayName={callConfig.displayName}
        initialStream={callConfig.stream}
        initialCamOn={callConfig.camOn}
        initialMicOn={callConfig.micOn}
        initialCamId={callConfig.selectedCamId}
        studioTrainedCount={studioTrainedCount}
        onExitCall={() => {
          if (isHost) {
            destroyHostBridge(true);
          }
          setCallConfig(null);
          setRoomCode('');
          setStage('hub');
        }}
        onToast={onToast}
      />
    );
  }

  return (
    <CallConnectHub
      initialRoomCode={prefillCode}
      initialError={hubError}
      selectedRole={role}
      onRoleChange={setRole}
      onHostRoomCreated={ensureHostBridge}
      onProceedToLobby={(code, hostFlag, mode) => {
        setHubError(null);
        if (hostFlag) {
          ensureHostBridge(code);
        }
        setRoomCode(code);
        setIsHost(hostFlag);
        setTransportMode(mode || 'ws');
        setStage('lobby');
      }}
      onToast={onToast}
    />
  );
}
