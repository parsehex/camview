import { OnvifDevice } from 'node-onvif';
import { OnvifDeviceInstance } from '../types/camera';

const deviceCache = new Map<string, OnvifDeviceInstance>();

export async function getDevice(
	xaddr: string,
	user = '',
	pass = '',
	cacheKey: string
): Promise<OnvifDeviceInstance> {
	let device: OnvifDeviceInstance;
	if (cacheKey && deviceCache.get(cacheKey)) {
		device = deviceCache.get(cacheKey)!;
		console.log('Using cached camera connection');
	} else {
		console.log('Opening new camera connection');
		const onvifDevice = new OnvifDevice({
			xaddr,
			user,
			pass,
		});
		await onvifDevice.init();
		device = onvifDevice as OnvifDeviceInstance; // Cast to the extended interface
		if (cacheKey) deviceCache.set(cacheKey, device);
	}
	return device;
}
