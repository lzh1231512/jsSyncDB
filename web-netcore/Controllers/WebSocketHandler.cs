using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace web_netcore.Controllers
{
    public class WebSocketHandler
    {
        [JsonObject(MemberSerialization.OptOut)]
        public class Client
        {
            public string DBName { set; get; }
            public string Code { set; get; }

            [JsonIgnore]
            public WebSocket socket { set; get; }
        }

        static List<Client> clients = new List<Client>();

        static void clearClients()
        {
            lock (clients)
            {
                clients.RemoveAll(f => f.socket.State != WebSocketState.Open);
            }
        }

        public static async Task sendMsg(string DBName,string Code)
        {
            clearClients();
            List<Client> clis;
            lock (clients)
            {
                clis = clients.Where(f => f.DBName == DBName && f.Code == Code).ToList();
            }
            foreach (var item in clis)
            {
                try
                {
                    byte[] x = Encoding.UTF8.GetBytes("1");
                    var outgoing = new ArraySegment<byte>(x);
                    await item.socket.SendAsync(outgoing, WebSocketMessageType.Text, true, CancellationToken.None);
                }
                catch { }
            }
        }

        static async Task Acceptor(HttpContext hc, Func<Task> n)
        {
            if (!hc.WebSockets.IsWebSocketRequest)
                return;
            clearClients();
            var socket = await hc.WebSockets.AcceptWebSocketAsync();
            if(socket.State == WebSocketState.Open)
            {
                var buffer = new byte[1024];
                var seg = new ArraySegment<byte>(buffer);
                var incoming = await socket.ReceiveAsync(seg, CancellationToken.None);
                string receivemsg = Encoding.UTF8.GetString(buffer, 0, incoming.Count);
                var cli = JsonConvert.DeserializeObject<Client>(receivemsg);
                cli.socket = socket;
                lock (clients)
                {
                    clients.Add(cli);
                }
                while (socket.State == WebSocketState.Open)
                {
                    await socket.ReceiveAsync(seg, CancellationToken.None);
                }
            }

        }

        /// <summary>
        /// branches the request pipeline for this SocketHandler usage
        /// </summary>
        /// <param name="app"></param>
        public static void Map(IApplicationBuilder app)
        {
            var webSocketOptions = new WebSocketOptions()
            {
                KeepAliveInterval = TimeSpan.FromSeconds(120)
            };
            app.UseWebSockets(webSocketOptions);
            app.Use(WebSocketHandler.Acceptor);
        }
    }
}