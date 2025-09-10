export interface CameraRequestBody {
	name: string;
	host: string;
	username?: string;
	password?: string;
}

export interface CameraUpdateRequestBody {
	name: string;
	rtspUrl: string;
	onvifUrl?: string;
	username?: string;
	password?: string;
}

export interface CameraDbRow {
	id: number;
	name: string;
	rtspUrl: string;
	onvifUrl: string;
	username: string;
	password?: string;
}

// this is not correct
export interface OnvifDeviceInstance {
	urn: string;
	name: string;
	xaddrs: string[];
	ptz: any;
	init(): Promise<void>;
	getStreamUri(options: { protocol: 'RTSP' }): Promise<{ uri: string }>;
	ptzMove(options: {
		speed: { x?: number; y?: number; z?: number };
		timeout?: number;
	}): Promise<void>;
	ptzStop(): Promise<void>;

	// correct:
	current_profile: any;
	services: {
		ptz: any;
		[key: string]: any;
	};
}
