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

export interface OnvifDeviceInstance {
	urn: string;
	name: string;
	xaddrs: string[];

	current_profile: any;
	services: {
		ptz: any;
		[key: string]: any;
	};

	// methods available once connected:
	init(): Promise<void>;
	ptzMove(options: {
		speed: { x?: number; y?: number; z?: number };
		timeout?: number;
	}): Promise<void>;
	ptzStop(): Promise<void>;
}
