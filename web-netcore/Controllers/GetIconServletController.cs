using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Myrmec;
using web_netcore.Commons;
using web_netcore.Models;

namespace web_netcore.Controllers
{
    public class GetIconServletController : Controller
    {

        private readonly IHostingEnvironment _hostingEnvironment;

        public GetIconServletController(IHostingEnvironment hostingEnvironment)
        {
            _hostingEnvironment = hostingEnvironment;
        }

        public IActionResult Index(String type, String domain)
        {
            var filePath = Configs.tempPath;
            var tempFilePath = "wd.jpg";
            filePath = _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
               + "/" + filePath.TrimEnd('\\', '/') + "/";
            System.IO.Directory.CreateDirectory(filePath);

            tempFilePath = _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
               + "/" + tempFilePath;
            Response.ContentType = "image/x-icon";
            Response.Headers.Add("expires", "Fri Feb 01 2999 00:00:00 GMT+0800");
            String p = filePath + "/" + domain + ".ico";
            if (!System.IO.File.Exists(p))
            {
                try
                {
                    String url = (type == ("1") ? "http" : "https") + "://" + domain + "/favicon.ico";
                    if (!HttpDownload(url, p))
                    {
                        System.IO.File.Copy(_hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
                            + "/wd.ico", p,true);
                    }
                }
                catch (Exception e)
                {
                }
            }
            return Redirect("~/" + Configs.tempPath + "/" + domain + ".ico");
        }

        public static bool HttpDownload(string url, string filePath)
        {
            try
            {
                string fileName = Path.GetFileName(url);
                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
                FileStream fs = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.ReadWrite);
                HttpWebRequest request = WebRequest.Create(url) as HttpWebRequest;
                HttpWebResponse response = request.GetResponse() as HttpWebResponse;
                Stream responseStream = response.GetResponseStream();
                byte[] bArr = new byte[1024];
                int iTotalSize = 0;
                int size = responseStream.Read(bArr, 0, (int)bArr.Length);
                while (size > 0)
                {
                    iTotalSize += size;
                    fs.Write(bArr, 0, size);
                    size = responseStream.Read(bArr, 0, (int)bArr.Length);
                }
                fs.Close();
                responseStream.Close();
                return IsImage(filePath);
            }
            catch
            {
                return false;
            }
        }
        /// 判断文件是否为图片
        /// </summary>
        /// <param name="path">文件的完整路径</param>
        /// <returns>返回结果</returns>
        public static Boolean IsImage(string path)
        {
            try
            {
                Sniffer sniffer = new Sniffer();
                sniffer.Populate(FileTypes.Common);

                byte[] fileHead = new byte[20];

                System.IO.FileStream fs = new FileStream(path, FileMode.Open);
                fs.Read(fileHead, 0, 20);
                fs.Close();
                fs.Dispose();

                // start match.
                List<string> results = sniffer.Match(fileHead);


                return results.Contains("ico")||
                    results.Contains("jpg")||
                    results.Contains("png")||
                    results.Contains("gif");
            }
            catch (Exception e)
            {
                return false;
            }
        }
    }
}