import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { map } from 'rxjs/operators';
import { WebsocketService } from "./websocket.service";

const STREAM_URL = "ws://fakarava94.no-ip.org:3000/strava2/stream/";

export interface Message {
  firstname: string;
  lastname: string;
  message: string;
}

@Injectable()
export class StreamService {
  public messages: Subject<Message>;
  public firstname: string;
  public lastname: string;

  constructor(wsService: WebsocketService) {
    console.log ('streamService constructor');
    this.messages = <Subject<Message>>wsService.connect(STREAM_URL).pipe(map(
      (response: MessageEvent): Message => {
        let data = JSON.parse(response.data);
        console.log ('streamService constructor, data=', data);
        return {
          firstname: data.firstname,
          lastname: data.lastname,
          message: data.message
        };
      }
    ));
  }
}