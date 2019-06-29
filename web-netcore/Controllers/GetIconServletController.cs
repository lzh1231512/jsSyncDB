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
            domain = domain.Replace(":", "_");
            var filePath = Configs.tempPath;
            var tempFilePath = "wd.jpg";
            filePath = _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
               + "/" + filePath.TrimEnd('\\', '/') + "/";
            System.IO.Directory.CreateDirectory(filePath);

            tempFilePath = _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
               + "/" + tempFilePath;
            String p = filePath + "/" + domain + ".ico";

            if (!System.IO.File.Exists(p))
            {
                String url = (type == ("1") ? "http" : "https") + "://" + domain + "/favicon.ico";
                ImageDownloader.addTask(url, p, _hostingEnvironment.WebRootPath.TrimEnd('\\', '/')
                        + "/wd.ico");
                return File("~/wd.ico", "image/x-icon");
            }
            
            Response.ContentType = "image/x-icon";
            Response.Headers.Add("expires", "Fri Feb 01 2999 00:00:00 GMT+0800");
            return File("~/" + Configs.tempPath + "/" + domain + ".ico", "image/x-icon");
        }

        
        
    }
}