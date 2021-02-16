import { Injectable } from "@angular/core";
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { SettingsService } from '.';

@Injectable()
export class AddHeaderInterceptor implements HttpInterceptor {
  constructor(private settingsService: SettingsService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const clonedRequest = req.clone({
	headers: req.headers.set('X-Device-Tag', this.settingsService.deviceTag)
    });
    return next.handle(clonedRequest);
  }
}
