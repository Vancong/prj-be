const OrderDtb=require('../models/Order.Model');
const productDtb=require('../models/Product.Model');
const generateOrderCode=require("../helper/generateOrderCode");
const paginationHelper=require("../helper/pagination");
const createErro=require("../helper/createError");
const VoucherService=require('../services/voucher.service')
const sendEmailHelpers=require('../helper/sendEmail.helpers')
const htmlSendMailOrder=require('../helper/HtmlSendMailOrder');
const createError = require('../helper/createError');
const VoucherDtb=require('../models/Voucher.Model')
module.exports.create= async(data) =>{

    let totalPrice = 0;
    let finalPrice=0;
    let updateItems = [];

    for (const item of data.items) {
        const product = await productDtb.findOne({ _id: item.product });
        if (!product) {
            throw createError(404, 'Sản phẩm không tồn tại');
        }
        const size= product.sizes.find(size => size.volume===item.volume);

        if (!size) {
            throw createError(404, 'Dung tích sản phẩm không tồn tại');
        }

        const discountPrice=size.price*(1- ((product.discount||0) /100));
        
        totalPrice+=discountPrice*item.quantity;

        updateItems.push({
            product: item.product,
            volume: item.volume,
            quantity: item.quantity,
            price: discountPrice
        });


        const res= await productDtb.updateOne({
            _id: item.product,
            "sizes.volume": item.volume,
            "sizes.countInStock": {$gte:item.quantity}
        },{ 
            $inc: { 'sizes.$.countInStock': -item.quantity } 
        })
        if(res.modifiedCount===0) {
            throw createError(400, 'Số lượng vượt quá tồn kho');
        }
     }

    const orderCode= await generateOrderCode();
    data.orderCode=orderCode;

    if(data.discountCode) {
        const voucherRes = await VoucherService.check(
                data.user,
                data.discountCode,
                totalPrice
        );
         finalPrice = voucherRes.data.discountValue;
    }
    

    const shipping= totalPrice>=1000000?0: 28000;
    data.shipping = shipping;
     finalPrice =totalPrice  + shipping-finalPrice;

    data.finalPrice=finalPrice;
    data.items=updateItems;
    data.totalPrice=totalPrice;

    if(data.paymentMethod==='paypal') {
        data.status='confirmed'
    }

    let newOrder= await OrderDtb.create(data);
    newOrder= await newOrder.populate('items.product', 'name images');

    if(newOrder.email) {
        const html=htmlSendMailOrder(
            newOrder.orderCode,
            newOrder.items,
            newOrder.totalPrice, 
            newOrder.finalPrice,
            newOrder.discountValue, 
            newOrder.shipping, 
            newOrder.paymentMethod
        )
        sendEmailHelpers(newOrder.email,'Hello',html)
    }


    if (data.discountCode) {
        const voucher = await VoucherDtb.findOne({ code: data.discountCode });

        const userUsed = voucher.usedBy.find(userby=> userby.userId.toString() === data.user);

        if (userUsed) {
            await VoucherDtb.updateOne(
                { _id: voucher._id, 'usedBy.userId': data.user },
                { $inc: { 'usedBy.$.count': 1, usageCount: 1 } }
            );
        } else {
            await VoucherDtb.updateOne(
                { _id: voucher._id },
                { $push: { usedBy: { userId: data.user, count: 1 } }, $inc: { usageCount: 1 } }
            );
        }
    
   }

    return {
    status: 'OK',
    message: 'Thành công ',
    data: newOrder
    };
   
}

module.exports.myOrder=async (userId,page,limit,filters) =>{
    let query={user: userId};
    if(filters.status) query.status=filters.status;
    console.log(filters)
    const myOrder = await paginationHelper({
        model: OrderDtb,
        page,
        limit,
        sort: { createdAt: -1 },
        query
    });
    return {
        status:'OK',
        data:myOrder
    }
}


module.exports.myOrderDetail=async (orderCode) =>{

    const order=await OrderDtb.findOne({orderCode: orderCode})
                                .populate('items.product','name images slug ');
    if (!order){
        throw createErro(404, "Không tìm thấy đơn hàng");
    } 
    return {
        status: 'OK',
        data: order,
    }
        

}

module.exports.cancelled=async (orderCode,status) =>{

    const order=await OrderDtb.findOne({orderCode});
    if (!order) {
        throw createErro(404, "Không tìm thấy đơn hàng");
    }
    if(order.isPaid) {
        status='refund_pending';
    }

    if(order.status==='confirmed'||order.status==='pending'){
            const res= await OrderDtb.updateOne({
                orderCode
            },{
                status
            })
            if(res.modifiedCount) {
                for (const item of order.items) {
                    await productDtb.updateOne({
                        _id: item.product,
                        "sizes.volume":item.volume
                    },{
                        $inc: {"sizes.$.countInStock": item.quantity}
                    })                
                }
            }
    }
    
    return {
        status: 'OK',
        message: 'Thanh cong',
    }
    
    
}


module.exports.getAll=async (limit,page,search,filters) =>{

    const {status,startDate,endDate,paymentMethod}=filters;
    const query={};
    const populate = { path: 'items.product', select: 'name' }
    if (search && search.trim() !== '') {
        query.$or =  [
            {orderCode:{ $regex: search}} ,
            {phone: {$regex: search}},
            {name: {$regex: search, $options:'i'}}
        ]
    }
    if(status) {
        query.status=status;
    }
    if(paymentMethod) {
        query.paymentMethod=paymentMethod;
    }

    if (startDate && endDate) {
      query.createdAt  = {
        $gte: new Date(startDate),
        $lt: new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000) 
      };
    }
    

     return await paginationHelper({
        model: OrderDtb,
        page,
        limit,
        query,
        populate
     }
     )
    
}

module.exports.updateStatus=async(orderCode,status,updatedBy) =>{
    const checkOrder=await OrderDtb.findOne({
        orderCode
    })
    if(!checkOrder) {
        throw create(400,"Không tồn tại đơn hàng")
    }
    const valid = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipping", "cancelled"],
      shipping: ["completed", "refund_pending"],
      completed: [],
      cancelled: [],
      refunded: [],
      refund_pending: ["refunded"]
    };

    if(!valid[checkOrder.status].includes(status)){
         throw createError(400,"Không thể chuyển sang trạng thái này" )
    }

    if(status=='cancelled'){
        for (const item of checkOrder.items) {
            await productDtb.updateOne({
                _id: item.product,
                "sizes.volume": item.volume
            },{
                $inc: {"sizes.$.countInStock":item.quantity }
            })
        }
    }

    if(checkOrder.status === 'shipping' &&status==='completed'){
        for (const item of checkOrder.items) {
            await productDtb.updateOne({
                _id: item.product,
                "sizes.volume": item.volume
            },{
                $inc: {"sizes.$.sold":item.quantity }
            })
        }
    }

    await OrderDtb.updateOne({
        orderCode
    },{status,updatedBy
    })

    return {
        status:'OK'
    }

}