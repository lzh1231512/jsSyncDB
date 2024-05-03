using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using System.IO.Compression;
using Microsoft.Extensions.DependencyInjection;
using System.Linq;
using Microsoft.Extensions.Hosting;
using web_netcore.Controllers;
var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});

builder.Services.AddResponseCompression(options =>
{
    //options.EnableForHttps = true;
    // 添加br与gzip的Provider
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    // 扩展一些类型 (MimeTypes中有一些基本的类型,可以打断点看看)
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "text/html; charset=utf-8",
        "application/xhtml+xml",
        "application/atom+xml",
        "image/Jpeg",
        "application/x-mpegURL",
        "image/svg+xml"
    });
});

// Add services to the container.
builder.Services.AddControllersWithViews();

var app = builder.Build();
app.UseResponseCompression();
// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}

app.UseCors(
    options => options.WithOrigins("*").AllowAnyMethod()
);

var provider = new FileExtensionContentTypeProvider();
provider.Mappings[".m3u8"] = "application/x-mpegURL"; //m3u8的MIME
provider.Mappings[".ts"] = "video/MP2TL"; //.ts的MIME
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = provider
});

app.UseRouting();
app.Map("/ws", WebSocketHandler.Map);
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
